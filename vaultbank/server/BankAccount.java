public class BankAccount {
    private String owner;
    private double balance;

    // constructor
    public BankAccount(String owner, double startingBalance) {
        this.owner = owner;
        this.balance = startingBalance;
    }

    // getters
    public String getOwner() {
        return owner;
    }

    public double getBalance() {
        return balance;
    }

    // deposit method
    public boolean deposit(double amount) {
        if (amount <= 0) return false;
        balance += amount;
        return true;
    }

    // withdraw method
    public boolean withdraw(double amount) {
        if (amount <= 0) return false;
        if (amount > balance) return false;
        balance -= amount;
        return true;
    }
}