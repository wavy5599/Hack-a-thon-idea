public class Test {
    public static void main(String[] args) {

        System.out.println("Server is running...");

        while (true) {

            for (int requestTime = 0; requestTime < 10; requestTime++) {
                try {
                    if (requestTime == 5) {
                        System.out.println("Request received at time: " + requestTime);
                    } else {
                        System.out.println("Waiting for request... Time: " + requestTime);
                    }

                    Thread.sleep(500); // simulate time passing

                } catch (InterruptedException e) {
                    System.out.println("An error occurred while processing the request.");
                    break;
                }
            }
        }
    }

}
