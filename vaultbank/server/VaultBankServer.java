import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import java.net.InetSocketAddress;
import java.net.URI;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class VaultBankServer {

    // ============================================================
    // HTTP client (shared)
    // ============================================================
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    // ============================================================
    // Demo balances
    // ============================================================
    private static final String ACCT_CHECKING_ID = "A-1001";
    private static final String ACCT_SAVINGS_ID  = "A-2001";
    private static final Map<String, AccountRec> ACCOUNTS = new HashMap<>();

    private static class AccountRec {
        String id, type, name;
        double balance;
        AccountRec(String id, String type, String name, double balance) {
            this.id = id; this.type = type; this.name = name; this.balance = balance;
        }
    }

    // ============================================================
    // In-memory transactions
    // ============================================================
    private static final List<TxRec> TXS = new ArrayList<>();

    private static class TxRec {
        String id, merchant, time;
        double amount; // negative spend, positive income
        TxRec(String id, String merchant, double amount, String time) {
            this.id = id; this.merchant = merchant; this.amount = amount; this.time = time;
        }
    }

    private static void seedDemoIfEmpty() {
        if (ACCOUNTS.isEmpty()) {
            ACCOUNTS.put(ACCT_CHECKING_ID, new AccountRec(ACCT_CHECKING_ID, "checking", "main checking", 1486.22));
            ACCOUNTS.put(ACCT_SAVINGS_ID,  new AccountRec(ACCT_SAVINGS_ID,  "savings",  "vault savings",  4872.10));
        }
        if (TXS.isEmpty()) {
            TXS.add(new TxRec("T-9001", "walmart",  -52.11, "today"));
            TXS.add(new TxRec("T-9002", "spotify",  -10.99, "yesterday"));
            TXS.add(new TxRec("T-9003", "doordash",  64.17, "jan 2"));
        }
    }

    // ============================================================
    // .env / env var debug
    // ============================================================
    private static String lastEnvLookupInfo = "";
    private static String lastEnvFileFound = "";
    private static boolean lastKeyLoaded = false;

    public static void main(String[] args) throws Exception {
        int port = 8080;
        seedDemoIfEmpty();

        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);

        // ------------------------------------------------------------
        // GET /health
        // ------------------------------------------------------------
        server.createContext("/health", ex -> {
            addCors(ex);
            if (isOptions(ex)) return;
            if (!isMethod(ex, "GET")) { sendJson(ex, 405, obj("ok", false, "message", "Use GET")); return; }
            sendJson(ex, 200, obj("ok", true, "message", "server is up"));
        });

        // ------------------------------------------------------------
        // GET /debug
        // ------------------------------------------------------------
        server.createContext("/debug", ex -> {
            addCors(ex);
            if (isOptions(ex)) return;
            if (!isMethod(ex, "GET")) { sendJson(ex, 405, obj("ok", false, "message", "Use GET")); return; }

            String key = loadGeminiApiKey();
            String out = "{"
                    + "\"ok\":true,"
                    + "\"cwd\":" + jsonString(System.getProperty("user.dir")) + ","
                    + "\"envFileFound\":" + jsonString(lastEnvFileFound) + ","
                    + "\"keyLoaded\":" + (key != null && !key.isBlank()) + ","
                    + "\"notes\":" + jsonString(lastEnvLookupInfo)
                    + "}";
            sendRawJson(ex, 200, out);
        });

        // ------------------------------------------------------------
        // POST /login
        // ------------------------------------------------------------
        server.createContext("/login", ex -> {
            addCors(ex);
            if (isOptions(ex)) return;
            if (!isMethod(ex, "POST")) { sendJson(ex, 405, obj("ok", false, "message", "Use POST")); return; }
            String body = readBody(ex);
            System.out.println("POST /login body: " + body);
            sendJson(ex, 200, obj("ok", true, "message", "Login was successful"));
        });

        // ------------------------------------------------------------
        // GET /me
        // ------------------------------------------------------------
        server.createContext("/me", ex -> {
            addCors(ex);
            if (isOptions(ex)) return;
            if (!isMethod(ex, "GET")) { sendJson(ex, 405, obj("ok", false, "message", "Use GET")); return; }

            String response = "{"
                    + "\"ok\":true,"
                    + "\"user\":{\"name\":\"david\",\"tier\":\"demo\"},"
                    + "\"accounts\":" + buildAccountsJson()
                    + "}";
            sendRawJson(ex, 200, response);
        });

        // ------------------------------------------------------------
        // GET /transactions
        // ------------------------------------------------------------
        server.createContext("/transactions", ex -> {
            addCors(ex);
            if (isOptions(ex)) return;
            if (!isMethod(ex, "GET")) { sendJson(ex, 405, obj("ok", false, "message", "Use GET")); return; }

            String out = "{"
                    + "\"ok\":true,"
                    + "\"items\":" + buildTransactionsJson()
                    + "}";
            sendRawJson(ex, 200, out);
        });

        // ------------------------------------------------------------
        // POST /transfer
        // Body: { "fromId":"A-1001", "toId":"A-2001", "amount": 150 }
        // ------------------------------------------------------------
        server.createContext("/transfer", ex -> {
            addCors(ex);
            if (isOptions(ex)) return;
            if (!isMethod(ex, "POST")) { sendJson(ex, 405, obj("ok", false, "message", "Use POST")); return; }

            String body = readBody(ex);
            System.out.println("POST /transfer body: " + body);

            String fromId = extractJsonString(body, "fromId");
            String toId   = extractJsonString(body, "toId");
            double amount = extractJsonNumber(body, "amount");

            if (fromId.isBlank() || toId.isBlank() || amount <= 0) {
                sendJson(ex, 400, obj("ok", false, "message", "Provide fromId, toId, and amount > 0"));
                return;
            }
            if (fromId.equals(toId)) {
                sendJson(ex, 400, obj("ok", false, "message", "fromId and toId must be different"));
                return;
            }

            AccountRec from = ACCOUNTS.get(fromId);
            AccountRec to   = ACCOUNTS.get(toId);
            if (from == null || to == null) {
                sendJson(ex, 404, obj("ok", false, "message", "Account not found"));
                return;
            }
            if (from.balance < amount) {
                String msg = "Insufficient funds in " + from.name + ". Available: " + money(from.balance);
                sendRawJson(ex, 400, "{\"ok\":false,\"message\":" + jsonString(msg) + "}");
                return;
            }

            from.balance = round2(from.balance - amount);
            to.balance   = round2(to.balance + amount);

            String receiptId = "XFER-" + Instant.now().toEpochMilli();
            String ts = Instant.now().toString();

            TXS.add(0, new TxRec(
                    "T-" + receiptId,
                    "transfer " + fromId + " → " + toId,
                    -round2(amount),
                    "just now"
            ));

            String out = "{"
                    + "\"ok\":true,"
                    + "\"transfer\":{"
                    + "\"id\":" + jsonString(receiptId) + ","
                    + "\"fromId\":" + jsonString(fromId) + ","
                    + "\"toId\":" + jsonString(toId) + ","
                    + "\"amount\":" + round2(amount) + ","
                    + "\"timestamp\":" + jsonString(ts)
                    + "},"
                    + "\"accounts\":" + buildAccountsJson()
                    + "}";
            sendRawJson(ex, 200, out);
        });

        // ------------------------------------------------------------
        // POST /ai/chat
        //
        // Request example:
        // { "message":"...", "accounts":[...], "transactions":[...] }
        //
        // Response:
        // - chat mode:    { ok:true, reply:"..." }
        // - decision mode:{ ok:true, decision:{...} }
        // ------------------------------------------------------------
        server.createContext("/ai/chat", ex -> {
            addCors(ex);
            if (isOptions(ex)) return;
            if (!isMethod(ex, "POST")) { sendJson(ex, 405, obj("ok", false, "message", "Use POST")); return; }

            String apiKey = loadGeminiApiKey();
            if (apiKey == null || apiKey.isBlank()) {
                String msg = "Missing GEMINI_API_KEY. Hit GET /debug to see cwd + .env search info.";
                sendRawJson(ex, 500, "{\"ok\":false,\"message\":" + jsonString(msg) + "}");
                return;
            }

            String body = readBody(ex);
            System.out.println("POST /ai/chat body: " + body);

            Map<String, Object> req = parseAiRequest(body);
            String userMessage = safeStr(req.get("message"));

            String accountsJson = toJsonOrEmptyArray(req.get("accountsJson"));
            String txJson = toJsonOrEmptyArray(req.get("transactionsJson"));
            if (accountsJson.equals("[]")) accountsJson = buildAccountsJson();
            if (txJson.equals("[]")) txJson = buildTransactionsJson();

            boolean decisionMode = looksLikeDecision(userMessage);

            try {
                if (decisionMode) {
                    DecisionCtx ctx = buildDecisionContextFromMessageAndTx(userMessage, txJson);
                    String raw = callGeminiDecisionJson(apiKey, userMessage, ctx, accountsJson, txJson);

                    // IMPORTANT: decision must be returned as REAL JSON object, not a string
                    String decisionObj = coerceToJsonObject(raw);
                    if (decisionObj == null) {
                        // fallback: return as plain reply string if model violated schema hard
                        sendRawJson(ex, 200, "{\"ok\":true,\"reply\":" + jsonString(raw) + "}");
                        return;
                    }

                    sendRawJson(ex, 200, "{\"ok\":true,\"decision\":" + decisionObj + "}");
                    return;
                }

                // normal chat
                String reply = callGeminiFintech(apiKey, userMessage, accountsJson, txJson);
                sendRawJson(ex, 200, "{\"ok\":true,\"reply\":" + jsonString(reply) + "}");

            } catch (Exception e) {
                e.printStackTrace();
                String msg = "Gemini error: " + (e.getMessage() == null ? "unknown" : e.getMessage());
                sendRawJson(ex, 500, "{\"ok\":false,\"message\":" + jsonString(msg) + "}");
            }
        });

        server.start();
        System.out.println("Server running:");
        System.out.println("   http://localhost:" + port + "/health");
        System.out.println("   http://localhost:" + port + "/debug");
        System.out.println("   http://localhost:" + port + "/login");
        System.out.println("   http://localhost:" + port + "/me");
        System.out.println("   http://localhost:" + port + "/transactions");
        System.out.println("   http://localhost:" + port + "/transfer   (POST)");
        System.out.println("   http://localhost:" + port + "/ai/chat");
    }

    // ============================================================
    // Build live accounts JSON
    // ============================================================
    private static String buildAccountsJson() {
        AccountRec c = ACCOUNTS.get(ACCT_CHECKING_ID);
        AccountRec s = ACCOUNTS.get(ACCT_SAVINGS_ID);
        if (c == null || s == null) seedDemoIfEmpty();

        c = ACCOUNTS.get(ACCT_CHECKING_ID);
        s = ACCOUNTS.get(ACCT_SAVINGS_ID);

        return "["
                + "{"
                + "\"id\":" + jsonString(c.id) + ","
                + "\"type\":" + jsonString(c.type) + ","
                + "\"name\":" + jsonString(c.name) + ","
                + "\"balance\":" + round2(c.balance)
                + "},"
                + "{"
                + "\"id\":" + jsonString(s.id) + ","
                + "\"type\":" + jsonString(s.type) + ","
                + "\"name\":" + jsonString(s.name) + ","
                + "\"balance\":" + round2(s.balance)
                + "}"
                + "]";
    }

    private static String buildTransactionsJson() {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        for (int i = 0; i < TXS.size(); i++) {
            TxRec t = TXS.get(i);
            if (i > 0) sb.append(",");
            sb.append("{")
                    .append("\"id\":").append(jsonString(t.id)).append(",")
                    .append("\"merchant\":").append(jsonString(t.merchant)).append(",")
                    .append("\"amount\":").append(round2(t.amount)).append(",")
                    .append("\"time\":").append(jsonString(t.time))
                    .append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    // ============================================================
    // KEY LOADING (env + .env with upward search)
    // ============================================================
    private static String loadGeminiApiKey() {
        lastEnvLookupInfo = "";
        lastEnvFileFound = "";
        lastKeyLoaded = false;

        String env = System.getenv("GEMINI_API_KEY");
        if (env != null && !env.isBlank()) {
            lastKeyLoaded = true;
            lastEnvLookupInfo = "loaded from OS environment";
            return stripQuotes(env.trim());
        }

        Path cwd = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        Path found = findDotEnvUpwards(cwd, 8);
        if (found == null) {
            lastEnvLookupInfo = "no .env found walking upward from cwd=" + cwd;
            return null;
        }

        lastEnvFileFound = found.toString();

        String key = readKeyFromDotEnv(found, "GEMINI_API_KEY");
        if (key == null || key.isBlank()) {
            lastEnvLookupInfo = "found .env but GEMINI_API_KEY not present or empty";
            return null;
        }

        lastKeyLoaded = true;
        lastEnvLookupInfo = "loaded from .env at " + found;
        return key;
    }

    private static Path findDotEnvUpwards(Path start, int maxLevels) {
        Path cur = start;
        for (int i = 0; i <= maxLevels; i++) {
            Path candidate = cur.resolve(".env");
            if (Files.exists(candidate)) return candidate;
            Path parent = cur.getParent();
            if (parent == null) break;
            cur = parent;
        }
        return null;
    }

    private static String readKeyFromDotEnv(Path envPath, String keyName) {
        try {
            for (String raw : Files.readAllLines(envPath, StandardCharsets.UTF_8)) {
                String line = raw.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;

                if (line.startsWith("export ")) line = line.substring("export ".length()).trim();

                int eq = line.indexOf('=');
                if (eq < 0) continue;

                String name = line.substring(0, eq).trim();
                String value = line.substring(eq + 1).trim();

                if (!name.equals(keyName)) continue;

                int hash = value.indexOf(" #");
                if (hash > -1) value = value.substring(0, hash).trim();

                return stripQuotes(value);
            }
        } catch (Exception e) {
            lastEnvLookupInfo = "failed reading .env: " + e.getMessage();
        }
        return null;
    }

    private static String stripQuotes(String s) {
        if (s == null) return null;
        s = s.trim();
        if ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'"))) {
            return s.substring(1, s.length() - 1).trim();
        }
        return s;
    }

    // ============================================================
    // CORS + HTTP helpers
    // ============================================================
    private static void addCors(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    }

    private static boolean isOptions(HttpExchange ex) throws IOException {
        if (ex.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return true;
        }
        return false;
    }

    private static boolean isMethod(HttpExchange ex, String method) {
        return ex.getRequestMethod().equalsIgnoreCase(method);
    }

    private static String readBody(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    // send already-built JSON string
    private static void sendRawJson(HttpExchange ex, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
        ex.close();
    }

    // helper for small objects (string/boolean only)
    private static void sendJson(HttpExchange ex, int status, String json) throws IOException {
        sendRawJson(ex, status, json);
    }

    // ============================================================
    // JSON helpers (safe string)
    // ============================================================
    private static String jsonString(String s) {
        if (s == null) s = "";
        return "\"" + s
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r") + "\"";
    }

    // quick builder for tiny JSON objects: obj("ok",true,"message","hi")
    private static String obj(Object... kv) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        for (int i = 0; i < kv.length; i += 2) {
            if (i > 0) sb.append(",");
            String k = String.valueOf(kv[i]);
            Object v = (i + 1 < kv.length) ? kv[i + 1] : "";
            sb.append(jsonString(k)).append(":");
            if (v instanceof Boolean || v instanceof Number) sb.append(String.valueOf(v));
            else sb.append(jsonString(String.valueOf(v)));
        }
        sb.append("}");
        return sb.toString();
    }

    private static String safeStr(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private static String toJsonOrEmptyArray(Object o) {
        if (o == null) return "[]";
        String s = String.valueOf(o).trim();
        return s.startsWith("[") ? s : "[]";
    }

    // tiny json extractors (transfer/request parsing)
    private static String extractJsonString(String raw, String key) {
        if (raw == null) return "";
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"(.*?)\"", Pattern.DOTALL).matcher(raw);
        if (m.find()) return unescapeJson(m.group(1)).trim();
        return "";
    }

    private static double extractJsonNumber(String raw, String key) {
        if (raw == null) return 0.0;
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)").matcher(raw);
        if (m.find()) return parseDoubleSafe(m.group(1));
        return 0.0;
    }

    private static Map<String, Object> parseAiRequest(String raw) {
        Map<String, Object> m = new HashMap<>();

        Matcher msg = Pattern.compile("\"message\"\\s*:\\s*\"(.*?)\"", Pattern.DOTALL).matcher(raw);
        if (msg.find()) m.put("message", unescapeJson(msg.group(1)));

        Matcher acc = Pattern.compile("\"accounts\"\\s*:\\s*(\\[.*?\\])", Pattern.DOTALL).matcher(raw);
        if (acc.find()) m.put("accountsJson", acc.group(1).trim());

        Matcher tx = Pattern.compile("\"transactions\"\\s*:\\s*(\\[.*?\\])", Pattern.DOTALL).matcher(raw);
        if (tx.find()) m.put("transactionsJson", tx.group(1).trim());

        return m;
    }

    private static String unescapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\n", "\n").replace("\\r", "\r").replace("\\\"", "\"").replace("\\\\", "\\");
    }

    // ============================================================
    // OpenAI-style response parsing: choices[0].message.content
    // ============================================================
    private static String extractFirstChoiceContent(String body) {
        if (body == null) return null;

        int msgIdx = body.indexOf("\"message\"");
        if (msgIdx < 0) return null;

        int contentKeyIdx = body.indexOf("\"content\"", msgIdx);
        if (contentKeyIdx < 0) return null;

        int colonIdx = body.indexOf(":", contentKeyIdx);
        if (colonIdx < 0) return null;

        int i = colonIdx + 1;
        while (i < body.length() && Character.isWhitespace(body.charAt(i))) i++;

        if (i >= body.length() || body.charAt(i) != '"') return null;
        i++;

        StringBuilder out = new StringBuilder();
        boolean esc = false;

        for (; i < body.length(); i++) {
            char c = body.charAt(i);
            if (esc) {
                switch (c) {
                    case '"': out.append('"'); break;
                    case '\\': out.append('\\'); break;
                    case '/': out.append('/'); break;
                    case 'b': out.append('\b'); break;
                    case 'f': out.append('\f'); break;
                    case 'n': out.append('\n'); break;
                    case 'r': out.append('\r'); break;
                    case 't': out.append('\t'); break;
                    case 'u':
                        if (i + 4 < body.length()) {
                            String hex = body.substring(i + 1, i + 5);
                            try { out.append((char) Integer.parseInt(hex, 16)); i += 4; }
                            catch (Exception e) { out.append("\\u").append(hex); i += 4; }
                        } else out.append("\\u");
                        break;
                    default: out.append(c);
                }
                esc = false;
                continue;
            }
            if (c == '\\') { esc = true; continue; }
            if (c == '"') return out.toString();
            out.append(c);
        }
        return null;
    }

    // ============================================================
    // IMPORTANT: turn model output into a JSON object (or null)
    // ============================================================
    private static String coerceToJsonObject(String raw) {
        if (raw == null) return null;
        String t = raw.trim();

        // already looks like a JSON object
        if (t.startsWith("{") && t.endsWith("}")) return t;

        // salvage first {...} from messy text
        String extracted = extractFirstJsonObject(t);
        if (extracted != null && extracted.startsWith("{") && extracted.endsWith("}")) return extracted;

        return null;
    }

    private static String extractFirstJsonObject(String s) {
        int start = s.indexOf('{');
        if (start < 0) return null;

        int depth = 0;
        boolean inString = false;
        boolean esc = false;

        for (int i = start; i < s.length(); i++) {
            char c = s.charAt(i);

            if (inString) {
                if (esc) { esc = false; continue; }
                if (c == '\\') { esc = true; continue; }
                if (c == '"') inString = false;
                continue;
            } else {
                if (c == '"') { inString = true; continue; }
                if (c == '{') depth++;
                if (c == '}') {
                    depth--;
                    if (depth == 0) return s.substring(start, i + 1).trim();
                }
            }
        }
        return null;
    }

    // ============================================================
    // Decision detection + cheap analytics
    // ============================================================
    private static boolean looksLikeDecision(String msg) {
        if (msg == null) return false;
        String m = msg.toLowerCase();
        return m.contains("$")
                || m.contains("spend")
                || m.contains("buy")
                || m.contains("pay ")
                || m.contains("purchase")
                || (m.contains("should i") && (m.contains("buy") || m.contains("spend") || m.contains("pay")));
    }

    private static class DecisionCtx {
        double purchaseAmount;
        String category;
        double assumedAnnualReturn = 0.08;
        int years10 = 10, years20 = 20, years30 = 30;

        double fv10, fv20, fv30;
        double hourlyWage = 15.0;
        double hoursOfWork;

        double spentThisWeek;
        double baselineWeeklySpend = 200.0;
        boolean spike;
        String spikeReason;
    }

    private static DecisionCtx buildDecisionContextFromMessageAndTx(String userMessage, String txJson) {
        DecisionCtx ctx = new DecisionCtx();

        ctx.purchaseAmount = extractDollarAmount(userMessage);
        ctx.category = guessCategory(userMessage);

        ctx.spentThisWeek = estimateSpentThisWeek(txJson);

        if (ctx.purchaseAmount > 0) {
            ctx.fv10 = futureValue(ctx.purchaseAmount, ctx.assumedAnnualReturn, ctx.years10);
            ctx.fv20 = futureValue(ctx.purchaseAmount, ctx.assumedAnnualReturn, ctx.years20);
            ctx.fv30 = futureValue(ctx.purchaseAmount, ctx.assumedAnnualReturn, ctx.years30);
            ctx.hoursOfWork = ctx.purchaseAmount / ctx.hourlyWage;
        }

        double projected = ctx.spentThisWeek + Math.max(0, ctx.purchaseAmount);
        ctx.spike = projected > ctx.baselineWeeklySpend * 1.5;
        ctx.spikeReason = ctx.spike
                ? "Projected discretionary spend (" + money(projected) + ") exceeds 1.5x baseline weekly spend (" + money(ctx.baselineWeeklySpend) + ")."
                : "No spike detected based on baseline weekly spend.";

        return ctx;
    }

    private static double extractDollarAmount(String msg) {
        if (msg == null) return 0.0;

        Matcher m = Pattern.compile("\\$(\\d+(?:\\.\\d{1,2})?)").matcher(msg);
        if (m.find()) return parseDoubleSafe(m.group(1));

        Matcher m2 = Pattern.compile("\\b(\\d+(?:\\.\\d{1,2})?)\\s*(dollars|bucks)\\b", Pattern.CASE_INSENSITIVE).matcher(msg);
        if (m2.find()) return parseDoubleSafe(m2.group(1));

        return 0.0;
    }

    private static String guessCategory(String msg) {
        if (msg == null) return "general";
        String m = msg.toLowerCase();
        if (m.contains("bar") || m.contains("club") || m.contains("drink")) return "nightlife";
        if (m.contains("doordash") || m.contains("uber eats") || m.contains("chipotle") || m.contains("food") || m.contains("eat")) return "food";
        if (m.contains("amazon") || m.contains("walmart") || m.contains("buy")) return "shopping";
        if (m.contains("gas") || m.contains("fuel")) return "transport";
        if (m.contains("tuition") || m.contains("book")) return "school";
        return "general";
    }

    private static double estimateSpentThisWeek(String txJson) {
        if (txJson == null) return 0.0;

        double total = 0.0;
        Pattern item = Pattern.compile("\\{[^}]*?\"amount\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*\"time\"\\s*:\\s*\"(.*?)\"[^}]*?\\}");
        Matcher m = item.matcher(txJson);

        while (m.find()) {
            double amt = parseDoubleSafe(m.group(1));
            String time = m.group(2).toLowerCase();

            boolean recent = time.contains("today") || time.contains("yesterday") || time.contains("just now");
            if (!recent) continue;

            if (amt < 0) total += (-amt);
        }

        return round2(total);
    }

    private static double futureValue(double p, double r, int years) {
        return round2(p * Math.pow(1.0 + r, years));
    }

    private static double parseDoubleSafe(String s) {
        try { return Double.parseDouble(s); } catch (Exception e) { return 0.0; }
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static String money(double v) {
        return "$" + String.format(Locale.US, "%.2f", v);
    }

    // ============================================================
    // Gemini (general fintech chat)
    // ============================================================
    private static String callGeminiFintech(String apiKey, String userMessage, String accountsJson, String txJson) throws Exception {

        String system = """
You are VaultBank AI, a fintech copilot.
Goals:
- Provide clear, actionable insights using the user's accounts and transactions.
- Keep answers concise and practical.
- If the user asks for a plan, respond with bullet steps.
- If something is missing, ask ONE short follow-up question.
- Never invent balances or transactions that are not provided.
Be kind and avoid jargon.
""";

        String context = "ACCOUNTS_JSON:\n" + accountsJson + "\n\nTRANSACTIONS_JSON:\n" + txJson;

        String prompt = system
                + "\n\nContext:\n" + context
                + "\n\nUser message:\n" + userMessage
                + "\n\nReturn:\n"
                + "1) a short answer\n"
                + "2) 3 bullets of reasoning using the provided data\n"
                + "3) one suggested next action";

        String url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        String model = "gemini-3-flash-preview";

        String requestJson = "{"
                + "\"model\":" + jsonString(model) + ","
                + "\"messages\":["
                + "{\"role\":\"system\",\"content\":" + jsonString(system) + "},"
                + "{\"role\":\"user\",\"content\":" + jsonString(prompt) + "}"
                + "]"
                + "}";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();

        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());

        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new RuntimeException("Gemini(OpenAI) HTTP " + res.statusCode() + " :: " + res.body());
        }

        String content = extractFirstChoiceContent(res.body());
        if (content != null) return content;

        return "AI response received, but could not parse model text.";
    }

    // ============================================================
    // Gemini (decision mode -> STRICT JSON)
    // ============================================================
    private static String callGeminiDecisionJson(String apiKey, String userMessage, DecisionCtx ctx, String accountsJson, String txJson)
            throws Exception {

        String system = """
You are VaultBank AI. You are coaching a college student to make high-ROI financial decisions.
You MUST output ONLY valid JSON (no markdown, no extra text).
Do NOT do any math yourself: use the numbers provided in the context.
Tone: concise, direct, helpful.
""";

        String context = ""
                + "ACCOUNTS_JSON:\n" + accountsJson + "\n\n"
                + "TRANSACTIONS_JSON:\n" + txJson + "\n\n"
                + "DECISION_CONTEXT_JSON:\n"
                + "{"
                + "\"purchaseAmount\":" + ctx.purchaseAmount + ","
                + "\"category\":" + jsonString(ctx.category) + ","
                + "\"assumedAnnualReturn\":" + ctx.assumedAnnualReturn + ","
                + "\"fv10\":" + ctx.fv10 + ","
                + "\"fv20\":" + ctx.fv20 + ","
                + "\"fv30\":" + ctx.fv30 + ","
                + "\"hourlyWage\":" + ctx.hourlyWage + ","
                + "\"hoursOfWork\":" + round2(ctx.hoursOfWork) + ","
                + "\"spentThisWeek\":" + ctx.spentThisWeek + ","
                + "\"baselineWeeklySpend\":" + ctx.baselineWeeklySpend + ","
                + "\"spike\":" + ctx.spike + ","
                + "\"spikeReason\":" + jsonString(ctx.spikeReason)
                + "}";

        String schema = """
Return JSON with EXACT keys:
{
  "riskLevel": "green" | "yellow" | "red",
  "oneLineVerdict": string,
  "why": [string, string],
  "betterOption": string,
  "ifYouDoItAnyway": string,
  "numbers": {
    "purchaseAmount": number,
    "fv10": number,
    "fv20": number,
    "fv30": number,
    "hoursOfWork": number,
    "spentThisWeek": number,
    "baselineWeeklySpend": number,
    "spike": boolean
  }
}
Rules:
- If purchaseAmount is 0 (missing), ask ONE question inside oneLineVerdict, set riskLevel to "yellow", keep other fields simple.
- Use spike=true as a strong signal for "red" unless the purchase is school/tuition related.
- Keep "why" to exactly 2 items.
""";

        String prompt = "Context:\n" + context + "\n\nUser message:\n" + userMessage + "\n\n" + schema;

        String url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        String model = "gemini-3-flash-preview";

        String requestJson = "{"
                + "\"model\":" + jsonString(model) + ","
                + "\"messages\":["
                + "{\"role\":\"system\",\"content\":" + jsonString(system) + "},"
                + "{\"role\":\"user\",\"content\":" + jsonString(prompt) + "}"
                + "]"
                + "}";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();

        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());

        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new RuntimeException("Gemini(OpenAI) HTTP " + res.statusCode() + " :: " + res.body());
        }

        String content = extractFirstChoiceContent(res.body());
        if (content != null) return content;

        return "{\"riskLevel\":\"yellow\",\"oneLineVerdict\":\"AI response received, but could not parse model text.\",\"why\":[\"Parse error\",\"Try again\"],\"betterOption\":\"\",\"ifYouDoItAnyway\":\"\",\"numbers\":{\"purchaseAmount\":0,\"fv10\":0,\"fv20\":0,\"fv30\":0,\"hoursOfWork\":0,\"spentThisWeek\":0,\"baselineWeeklySpend\":0,\"spike\":false}}";
    }
}