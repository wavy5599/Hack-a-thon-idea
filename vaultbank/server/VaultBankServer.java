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

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class VaultBankServer {

    // one shared client
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    // store debug info about where we loaded from
    private static String lastEnvLookupInfo = "";
    private static String lastEnvFileFound = "";
    private static boolean lastKeyLoaded = false;

    public static void main(String[] args) throws Exception {
        int port = 8080;

        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);

        // -----------------------------
        // GET /health
        // -----------------------------
        server.createContext("/health", exchange -> {
            addCors(exchange);
            if (isOptions(exchange)) return;

            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                send(exchange, 405, "{\"ok\":false,\"message\":\"Use GET\"}");
                return;
            }
            send(exchange, 200, "{\"ok\":true,\"message\":\"server is up\"}");
        });

        // -----------------------------
        // GET /debug  (helps you see WHY key isn't loading)
        // -----------------------------
        server.createContext("/debug", exchange -> {
            addCors(exchange);
            if (isOptions(exchange)) return;

            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                send(exchange, 405, "{\"ok\":false,\"message\":\"Use GET\"}");
                return;
            }

            // attempt load just for debug output
            String key = loadGeminiApiKey();

            String out = "{"
                    + "\"ok\":true,"
                    + "\"cwd\":" + jsonString(System.getProperty("user.dir")) + ","
                    + "\"envFileFound\":" + jsonString(lastEnvFileFound) + ","
                    + "\"keyLoaded\":" + (key != null && !key.isBlank()) + ","
                    + "\"notes\":" + jsonString(lastEnvLookupInfo)
                    + "}";

            send(exchange, 200, out);
        });

        // -----------------------------
        // POST /login
        // -----------------------------
        server.createContext("/login", exchange -> {
            addCors(exchange);
            if (isOptions(exchange)) return;

            if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
                send(exchange, 405, "{\"ok\":false,\"message\":\"Use POST\"}");
                return;
            }

            String body = readBody(exchange);
            System.out.println("POST /login body: " + body);

            send(exchange, 200, "{\"ok\":true,\"message\":\"Login was successful\"}");
        });

        // -----------------------------
        // GET /me
        // -----------------------------
        server.createContext("/me", exchange -> {
            addCors(exchange);
            if (isOptions(exchange)) return;

            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                send(exchange, 405, "{\"ok\":false,\"message\":\"Use GET\"}");
                return;
            }

            String response = """
                {
                  "ok": true,
                  "user": { "name": "david", "tier": "demo" },
                  "accounts": [
                    { "id": "A-1001", "type": "checking", "name": "main checking", "balance": 3284.55 },
                    { "id": "A-2001", "type": "savings",  "name": "vault savings", "balance": 7421.20 }
                  ]
                }
                """;

            send(exchange, 200, compactJson(response));
        });

        // -----------------------------
        // GET /transactions
        // -----------------------------
        server.createContext("/transactions", exchange -> {
            addCors(exchange);
            if (isOptions(exchange)) return;

            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                send(exchange, 405, "{\"ok\":false,\"message\":\"Use GET\"}");
                return;
            }

            String response = """
                {
                  "ok": true,
                  "items": [
                    { "id": "T-9001", "merchant": "walmart",  "amount": -52.11, "time": "today" },
                    { "id": "T-9002", "merchant": "spotify",  "amount": -10.99, "time": "yesterday" },
                    { "id": "T-9003", "merchant": "doordash", "amount":  64.17, "time": "jan 2" }
                  ]
                }
                """;

            send(exchange, 200, compactJson(response));
        });

        // -----------------------------
        // POST /ai/chat
        // -----------------------------
        server.createContext("/ai/chat", exchange -> {
            addCors(exchange);
            if (isOptions(exchange)) return;

            if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
                send(exchange, 405, "{\"ok\":false,\"message\":\"Use POST\"}");
                return;
            }

            String apiKey = loadGeminiApiKey();
            if (apiKey == null || apiKey.isBlank()) {
                String msg = "Missing GEMINI_API_KEY. Hit GET /debug to see cwd + .env search info.";
                send(exchange, 500, "{\"ok\":false,\"message\":" + jsonString(msg) + "}");
                return;
            }

            String body = readBody(exchange);
            System.out.println("POST /ai/chat body: " + body);

            Map<String, Object> req = parseAiRequest(body);
            String userMessage = safeStr(req.get("message"));

            String accountsJson = toJsonOrEmptyArray(req.get("accountsJson"));
            String txJson = toJsonOrEmptyArray(req.get("transactionsJson"));

            if (accountsJson.equals("[]") || txJson.equals("[]")) {
                accountsJson = """
                    [
                      { "id": "A-1001", "type": "checking", "name": "main checking", "balance": 3284.55 },
                      { "id": "A-2001", "type": "savings",  "name": "vault savings", "balance": 7421.20 }
                    ]
                    """;
                txJson = """
                    [
                      { "id": "T-9001", "merchant": "walmart",  "amount": -52.11, "time": "today" },
                      { "id": "T-9002", "merchant": "spotify",  "amount": -10.99, "time": "yesterday" },
                      { "id": "T-9003", "merchant": "doordash", "amount":  64.17, "time": "jan 2" }
                    ]
                    """;
                accountsJson = compactJson(accountsJson);
                txJson = compactJson(txJson);
            }

            try {
                String reply = callGeminiFintech(apiKey, userMessage, accountsJson, txJson);
                String out = "{\"ok\":true,\"reply\":" + jsonString(reply) + "}";
                send(exchange, 200, out);
            } catch (Exception e) {
                e.printStackTrace();
                String msg = "Gemini error: " + (e.getMessage() == null ? "unknown" : e.getMessage());
                send(exchange, 500, "{\"ok\":false,\"message\":" + jsonString(msg) + "}");
            }
        });

        server.start();
        System.out.println("Server running:");
        System.out.println("   http://localhost:" + port + "/health");
        System.out.println("   http://localhost:" + port + "/debug");
        System.out.println("   http://localhost:" + port + "/login");
        System.out.println("   http://localhost:" + port + "/me");
        System.out.println("   http://localhost:" + port + "/transactions");
        System.out.println("   http://localhost:" + port + "/ai/chat");
    }

    // ============================================================
    // KEY LOADING (env + .env with upward search)
    // ============================================================

    private static String loadGeminiApiKey() {
        lastEnvLookupInfo = "";
        lastEnvFileFound = "";
        lastKeyLoaded = false;

        // 1) OS env var first
        String env = System.getenv("GEMINI_API_KEY");
        if (env != null && !env.isBlank()) {
            lastKeyLoaded = true;
            lastEnvLookupInfo = "loaded from OS environment";
            return stripQuotes(env.trim());
        }

        // 2) walk upward from cwd looking for .env
        Path cwd = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        Path found = findDotEnvUpwards(cwd, 8); // check cwd, parent, etc

        if (found == null) {
            lastEnvLookupInfo = "no .env found walking upward from cwd=" + cwd;
            return null;
        }

        lastEnvFileFound = found.toString();

        // 3) parse .env
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

                // allow: export KEY=...
                if (line.startsWith("export ")) line = line.substring("export ".length()).trim();

                int eq = line.indexOf('=');
                if (eq < 0) continue;

                String name = line.substring(0, eq).trim();
                String value = line.substring(eq + 1).trim();

                if (!name.equals(keyName)) continue;

                // remove inline comments: KEY=abc # comment
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

    private static void addCors(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    }

    private static boolean isOptions(HttpExchange exchange) throws IOException {
        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return true;
        }
        return false;
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream in = exchange.getRequestBody()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void send(HttpExchange exchange, int status, String response) throws IOException {
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
        exchange.close();
    }

    // ============================================================
    // JSON helpers
    // ============================================================

    private static String compactJson(String json) {
        return json.replace("\r", "")
                .replace("\n", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static String jsonString(String s) {
        if (s == null) s = "";
        return "\"" + s
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r") + "\"";
    }

    private static String safeStr(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private static String toJsonOrEmptyArray(Object o) {
        if (o == null) return "[]";
        String s = String.valueOf(o).trim();
        return s.startsWith("[") ? s : "[]";
    }

    private static Map<String, Object> parseAiRequest(String raw) {
        Map<String, Object> m = new HashMap<>();

        Matcher msg = Pattern.compile("\"message\"\\s*:\\s*\"(.*?)\"", Pattern.DOTALL).matcher(raw);
        if (msg.find()) m.put("message", unescapeJson(msg.group(1)));

        Matcher acc = Pattern.compile("\"accounts\"\\s*:\\s*(\\[.*?\\])", Pattern.DOTALL).matcher(raw);
        if (acc.find()) m.put("accountsJson", compactJson(acc.group(1)));

        Matcher tx = Pattern.compile("\"transactions\"\\s*:\\s*(\\[.*?\\])", Pattern.DOTALL).matcher(raw);
        if (tx.find()) m.put("transactionsJson", compactJson(tx.group(1)));

        return m;
    }

    private static String unescapeJson(String s) {
        return s.replace("\\n", "\n").replace("\\\"", "\"").replace("\\\\", "\\");
    }

    // ============================================================
    // Gemini
    // ============================================================
private static String callGeminiFintech(String apiKey, String userMessage, String accountsJson, String txJson)
        throws Exception {

    String system = """
You are VaultBank AI, a fintech copilot.
Goals:
- Provide clear, actionable insights using the user's accounts and transactions.
- Keep answers concise and practical.
- If the user asks for a plan, respond with bullet steps.
- If something is missing, ask ONE short follow-up question.
- Never invent balances or transactions that are not provided.
""";

    String context = "ACCOUNTS_JSON:\n" + accountsJson + "\n\nTRANSACTIONS_JSON:\n" + txJson;

    String prompt = system
            + "\n\nContext:\n" + context
            + "\n\nUser message:\n" + userMessage
            + "\n\nReturn:\n"
            + "1) a short answer\n"
            + "2) 3 bullets of reasoning using the provided data\n"
            + "3) one suggested next action";

    // ✅ use OpenAI-compatible Gemini endpoint
    String url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    // ✅ model name that exists on the openai-compatible endpoint
    String model = "gemini-3-flash-preview";

    // OpenAI-style request:
    // { "model":"...", "messages":[{"role":"system","content":"..."},{"role":"user","content":"..."}] }
    String requestJson = "{"
            + "\"model\":" + jsonString(model) + ","
            + "\"messages\":["
            + "{\"role\":\"system\",\"content\":" + jsonString(system) + "},"
            + "{\"role\":\"user\",\"content\":" + jsonString(prompt) + "}"
            + "]"
            + "}";

    HttpClient client = HttpClient.newHttpClient();
    HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            // ✅ IMPORTANT: bearer auth, NOT ?key=
            .header("Authorization", "Bearer " + apiKey)
            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
            .build();

    HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());

    if (res.statusCode() < 200 || res.statusCode() >= 300) {
        throw new RuntimeException("Gemini(OpenAI) HTTP " + res.statusCode() + " :: " + res.body());
    }

    // Extract: choices[0].message.content
    Matcher m = Pattern.compile("\"content\"\\s*:\\s*\"(.*?)\"", Pattern.DOTALL).matcher(res.body());
    if (m.find()) return unescapeJson(m.group(1));

    return "AI response received, but could not parse model text.";
}
}