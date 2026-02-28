import java.util.Scanner;
public class Main {
    public static void main(String[] args) {

        Scanner sncr = new Scanner(System.in);
        String option; 

        BankAccount acc = new BankAccount("David", 100.00);

        System.out.println("Please select one of the options below ");
        System.out.println("Deposit, Withdraw, Check Balance");
        option = sncr.nextLine();


        try{ if (option.equals("Deposit") || option.equals("deposit")){
            System.out.println("Please enter the amount you want to deposit \n");
            double amount = sncr.nextDouble();
            if (acc.deposit(amount)) {
                System.out.println("Deposit successful. Your new balance is: " + acc.getBalance());
            } else {
                System.out.println("Deposit failed. Please enter a valid amount.");
            }

        } else if (option.equals("Withdraw") || option.equals("withdraw")){
            System.out.println("Please enter the amount you want to withdraw \n");
            double amount = sncr.nextDouble();
            if (acc.withdraw(amount)) {
                System.out.println("Withdrawal successful. Your new balance is: " + acc.getBalance());
            } else {
                System.out.println("Withdrawal failed. Please check your balance and enter a valid amount.");
            }
        } else if (option.equals("Check Balance") || option.equals("check balance")){
            System.out.println("Your current balance is: " + acc.getBalance());
        } else {
            System.out.println("Invalid option. Please select Deposit, Withdraw, or Check Balance.");
        }
        } catch (Exception e) {
            System.out.println("An error occurred: " + e.getMessage());
            
        }

        
    }


}