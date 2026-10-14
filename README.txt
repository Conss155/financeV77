FULLBRIGHT COLLEGE SMS - FINANCE & REPORTING MODULE
===================================================

FILES
  index.html            Login / Sign up / Forgot password
  reset-password.html   Page opened from the "reset password" email
  student.html + student.js   Student pages (Fees, Payment, Financial & Academic reports, Notifications)
  admin.html + admin.js       Admin pages (Dashboard, Students, Fees, Payments, Reports, Notifications)
  config.js             <-- put your Supabase URL + anon key here
  style.css, logo.jpg
  database.sql          <-- run this in Supabase once
  demo-setup.sql        <-- run this after database.sql (for the Demo buttons)

SETUP (about 5 minutes)
 1. Go to https://supabase.com -> New project.
 2. SQL Editor -> New query -> paste ALL of database.sql -> Run.
 3. Project Settings -> API -> copy "Project URL" and "anon public" key into config.js.
 4. Authentication -> URL Configuration -> Site URL: http://127.0.0.1:5500
    and add Redirect URL: http://127.0.0.1:5500/**
    (For quick testing you may turn OFF "Confirm email" in Authentication -> Providers -> Email.)
 5. In VS Code install the "Live Server" extension, right-click index.html -> "Open with Live Server".
    (Do not double-click the file; it must run from http:// for login to work.)
 6. Sign up an account for the admin, then in SQL Editor run:
      insert into public.user_roles (user_id, role)
      select id, 'admin' from auth.users where email = 'YOUR-ADMIN-EMAIL';
    Log out and log in again -> you will land on the Admin page.
 7. Students sign up normally and land on the Student page.
 8. DEMO BUTTONS: in SQL Editor also run ALL of demo-setup.sql once.
    Then click "Demo Student" or "Demo Admin" on the login page - no typing needed.
    These are real accounts: payments, fees, grades and notifications are saved.
      Demo Admin   : demo.admin@fullbright.edu   / Demo@12345
      Demo Student : demo.student@fullbright.edu / Demo@12345

HOW IT WORKS
 - Admin adds Prelim/Midterm/Finals fees (to one or all students) under Fees.
 - Students see their balance and pay through the demo gateway (GCash/Maya/Card/Bank).
   Payments are saved in the database with a reference number and receipt.
 - Students get automatic reminders when a term is due within 14 days or overdue,
   and admins can send reminders/announcements from Notifications.
 - Admin encodes grades under Academic Reports; students see their grades and GWA.
