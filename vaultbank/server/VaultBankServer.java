import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class VaultBankServer {

    public static void main(String[] args) throws Exception {
        int port = 8080;

        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);

        // quick test endpoint
        server.createContext("/health", exchange -> {
            addCors(exchange);

            if (isOptions(exchange)) return;

            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                send(exchange, 405, "{\"ok\":false,\"message\":\"Use GET\"}");
                return;
            }

            send(exchange, 200, "{\"ok\":true,\"message\":\"server is up\"}");
        });

        server.createContext("/login", exchange -> {
            addCors(exchange);

            if (isOptions(exchange)) return;

            if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
                send(exchange, 405, "{\"ok\":false,\"message\":\"Use POST\"}");
                return;
            }

            // read body (not required for demo, but useful)
            String body = readBody(exchange);
            System.out.println("POST /login body: " + body);

            // demo: always succeed
            send(exchange, 200, "{\"ok\":true,\"message\":\"Login was successful\"}");
        });

        server.start();
        System.out.println("✅ Server running:");
        System.out.println("   http://localhost:" + port + "/health");
        System.out.println("   http://localhost:" + port + "/login");
    }

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
}