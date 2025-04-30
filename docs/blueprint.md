# **App Name**: VisionClear Manager

## Core Features:

- Login Authentication: Login page with username 'visionclear' and password 'visionclear@2025'.
- Main Menu: Options page with buttons for 'New Bill', 'Search Customers', and 'Add Customers'.
- Invoice Generation & Prescription: New Bill page with input fields for bill details, customer information, power details (SPH, CYL, Axis, Addition, PD), product details (name, price, quantity, total), and payment details (discount, net price, advance, balance). Includes database storage (and excel export) upon confirmation and redirection to a print page for invoice and prescription, incorporating the shop logo.
- Customer Search & Management: Search Customers page with a search field and button to find customers by phone number, displaying results in a table format with details and options to Delete and Edit customers.
- Customer Data Capture: 'Add Customer' page is similar to the 'New Bill' but focused on customer data capture with financial transaction, without generating invoice. Includes database storage (and excel export). Only save button and confirmation message upon save.

## Style Guidelines:

- Primary color: Soft blue (#D1E2FF) for a professional and trustworthy feel.
- Secondary color: Light gray (#F5F5F5) for backgrounds and subtle accents.
- Accent color: Teal (#008080) for buttons and interactive elements.
- Clean and organized layout with clear sections for each data entry field.
- Use of tables for displaying customer search results.
- Use relevant icons for buttons and actions (e.g., save, search, delete, edit).
- Subtle transitions and animations for a smooth user experience.
- Use the uploaded logo to create branding in pages and also in the invoice.

## Original User Request:
Create a web application for my optical shop to generate invoice, prescription and store data in mysql database. Firstly a login page where the username is "visionclear" and password is "visionclear@2025". After logging options page must appear with three buttons 'New Bill', 'Search Customers', 'Add Customers'. If 'New Bill' is select a new page must appear and The input fields are bill number, date and time, Customer name, phone number, power details with sph, cy, axix, addition and pd measurement for both eyes. Next four input rows for product name, price, quantity and total price. Below four rows a discount, net price, advance amount and balance amount rows. Once I hit the submit button below it must give a confirmation message once confirmed the data must be stored in mysql database and also redirected to a print page with invoice and power prescription, the invoice and prescription must include the shop logo. If 'Search Customers' is selected a page must appear with a search field and button. If a mobile number is entered and hit search button, it must give all the customers associated with the phone number in table format with all the details. Also Delete and Edit customers operations must be available. If 'Add Customers' is selected then a page similar to 'New Bill' must appear but only with a save button and a confirmation message where the data will be stored in database without generating invoice. Make the application with good UI/UX and don't mess up the functionalities. Use the logo that I've attached wherevere required. The Add Customer Page must include financial transactions too but without generating invoice. The data of the customer must be stored in the database and also in an excel file
  