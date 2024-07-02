# Institute-Hub

Install the node dependencies
Install Oracle database
IN Table.txt run all the SQL commands in your oracle database

Institute Hub Application
Overview
Institute Hub is a web application designed to facilitate various administrative tasks within an educational institute, including task management, event creation, resource scheduling, and communication among users.

Features
Task Management
Create Tasks: Users can create tasks with details such as name, description, deadline, and assignee.
View Tasks: Display all tasks with options to update or delete tasks.
Task Deadline Notifications: Alerts users about upcoming task deadlines.
Event Management
Create Events: Admins or authorized users can create events specifying details like name, description, type, date, and location.
View Events: Display all created events with options to register for events and view registrations.
Event Registrations: Allow users to register for events, view registered events, and manage registrations.
Resource Management
Schedule Resources: Users can schedule resources specifying type, details, date, and time.
View Resources: Display scheduled resources for a specific date, including type, details, and booking information.
Communication Platform
Announcements: Send announcements to students, faculty, and staff.
Notifications: Notify users about events, deadlines, and important updates.
Reminders: Schedule and send reminders for tasks and events.
Technologies Used
Node.js: Backend server environment.
Express: Web framework for Node.js.
Oracle Database: For data storage and management.
HTML/CSS/JavaScript: Frontend development.
Pug: Template engine for HTML rendering.
Setup Instructions
Clone the repository: git clone <repository-url>
Install dependencies: npm install
Configure Oracle Database: Update dbConfig.js with your Oracle DB credentials.
Run the application: npm start
API Endpoints
Tasks
GET /tasks: Retrieve all tasks.
POST /create-task: Create a new task.
Events
GET /events: Retrieve all events.
POST /create-event: Create a new event.
GET /registered-events: Retrieve events registered by a user.
POST /register-event: Register for an event.
Resources
GET /scheduled-resources: Retrieve all scheduled resources.
POST /schedule-resource: Schedule a new resource.
Communication
Announcements, Notifications, and Reminders: Features integrated into the frontend for communication purposes.
Contributors
John Doe (@johndoe) - Project Lead & Backend Developer
Jane Smith (@janesmith) - Frontend Developer & UI/UX Designer
