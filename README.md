<div align="center">
  <img src="https://i.imgur.com/PkVpSju.jpeg" alt="qb-management banner" width="100%">
</div>

# 🏢 qb-management

A comprehensive, premium, and fully-featured society and gang management system for QBCore. Experience a modern, sleek UI packed with powerful tools to manage your in-game organizations with ease.

## ✨ Features

- **Modern UI/UX**: A beautifully redesigned NUI featuring Dark and Light modes, clean typography, and buttery-smooth micro-animations.
- **Financial Dashboard**:
  - Track **Total Input**, **Total Output**, and **Current Balance**.
  - **Dynamic Trend Charts**: Visualize Income and Expense trends with time filters (Last Hour, Day, Week, Month, 3 Months).
  - Quick actions to seamlessly **Deposit** or **Withdraw** society funds.
- **Employee Management**:
  - View all employees and their online/offline status.
  - Quick action buttons to **Promote**, **Demote**, or **Fire** employees.
  - Search filter to easily find specific members.
- **Recruitment Center**:
  - Scan for nearby players and instantly send employment offers.
- **Transaction History**:
  - Detailed audit logs of all society financial transactions (source, amount, date, and description).
- **QBCore Integrated**: Built natively for QBCore with seamless integration for jobs and gangs using `exports['qb-core']:DrawText()` interaction.

## 🛠️ Installation

1. Download the resource and place it in your `[qb]` folder.
2. Run the provided `qb-management.sql` file in your database to create the necessary tables.
3. Ensure the resource is started in your `server.cfg`:
   ```sh
   ensure qb-management
   ```
4. Restart your server.

## 🗄️ Database Tables

The script utilizes the following tables (all included in `qb-management.sql`):
- `management_funds`
- `management_transactions`


## 📜 License

This project is licensed under the MIT License.
