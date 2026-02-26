import java.util.Scanner;
public class Main {
    public static void main(String[] args) {

        Scanner sncr = new Scanner(System.in);
        String option; 

        BankAccount acc = new BankAccount("David", 100.00);

        System.out.println("Please select one of the options below ");
        System.out.println("Deposit, Withdraw, Check Balance");
        option = sncr.nextLine();


        if (option.equals("option") || option.equals("Option")){
            System.out.println("Please enter the amount you want to deposit \n");
            double amount = sncr.nextDouble();
            if (acc.deposit(amount)) {
                System.out.println("Deposit successful. Your new balance is: " + acc.getBalance());
            } else {
                System.out.println("Deposit failed. Please enter a valid amount.");
            }
        
            
        }

        
    }
}