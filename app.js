const express = require('express');
const pug=require('pug');
const path=require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');

const app=express();
const port=3000;
const dbConfig = {
    user: 'system',
    password: 'system',
    connectString: 'localhost:1521/XEPDB1'
  };

function create_session_id(email){
      let date = new Date();
      let ssid = date.getFullYear().toString() +
                (date.getMonth() + 1).toString().padStart(2, '0') +  
                date.getDate().toString().padStart(2, '0') +
                date.getHours().toString().padStart(2, '0') +
                date.getMinutes().toString().padStart(2, '0') +
                date.getSeconds().toString().padStart(2, '0') +
                date.getMilliseconds().toString().padStart(3, '0');
      return ssid+"_"+email;
}
function get_email(ssid){
      let flag = false;
      let newSsid = '';

      for (let i = 0; i < ssid.length; i++) {
        if (flag) {
          newSsid += ssid[i];
        }
          if (ssid[i] === '_') {
              flag = true;
          }
          
      }
      return newSsid;
}

function get_number(){
  // Get the current date and time
  const currentDate = new Date();

  // Convert to a numeric timestamp
  const numericTimestamp = currentDate.getTime();

  return numericTimestamp; 

}

async function getClobAsString(clob) {
  return new Promise((resolve, reject) => {
      if (clob === null) {
          resolve(null);
          return;
      }

      let clobString = '';
      clob.setEncoding('utf8');
      
      clob.on('data', chunk => {
          clobString += chunk;
      });
      
      clob.on('end', () => {
          resolve(clobString);
      });

      clob.on('error', err => {
          reject(err);
      });
  });
}

async function getClobAsString2(clob) {
  return new Promise((resolve, reject) => {
      let clobString = '';
      clob.setEncoding('utf8');
      clob.on('data', chunk => {
          clobString += chunk;
      });
      clob.on('end', () => {
          resolve(clobString);
      });
      clob.on('error', err => {
          reject(err);
      });
  });
}



//EXPRESS STUFF
app.use('/static',express.static('static'));       //setting static files directory in static folder
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies
app.use(express.json()); // To parse JSON bodies
app.use(cookieParser());


//PUG STUFF
app.set('view engine','pug');                // setting template engine as pug
app.set('views',path.join(__dirname,'views'));           //setup views directory


app.get('/',(req,res)=>{
    let ssid=req.cookies['ssid']

    if (ssid === undefined){
        let p=path.join(__dirname,'static','dfindex.html')
        res.sendFile(p)
    }else{
        res.render('index.pug')
    }
        
});

app.get('/signin',(req,res)=>{
    let p=path.join(__dirname,'static','signin.html')
    res.sendFile(p)
})

app.get('/signup',(req,res)=>{
    let p=path.join(__dirname,'static','signup.html')
    res.sendFile(p)
})

app.post('/signup', async (req, res) => {
  const { userType, name, email, password, dob, gender, phone, admissionNumber, course, position, branch, address } = req.body;

  try {
      const connection = await oracledb.getConnection(dbConfig);

      let sql;
      let binds;

      if (userType === 'student') {
          sql = `INSERT INTO students (name, email, password, dob, gender, phone, admission_number, course, address) 
                 VALUES (:name, :email, :password, TO_DATE(:dob, 'YYYY-MM-DD'), :gender, :phone, :admissionNumber, :course, :address)`;
          binds = { name, email, password, dob, gender, phone, admissionNumber, course, address };
      } else if (userType === 'staff') {
          sql = `INSERT INTO staff (name, email, password, date_of_birth, gender, phone_number, position, branch, address) 
                 VALUES (:name, :email, :password, TO_DATE(:dob, 'YYYY-MM-DD'), :gender, :phone, :position, :branch, :address)`;
          binds = { name, email, password, dob, gender, phone, position, branch, address };
      } else {
          res.status(400).send('Invalid user type');
          return;
      }

      await connection.execute(sql, binds, { autoCommit: true });

      let ssid=create_session_id(email);
      await connection.execute(`INSERT into cookie VALUES(:email,:session_id)`,[email,ssid],{autoCommit:true});

      res.cookie('ssid',ssid,{ httpOnly: true })
      res.cookie('type',userType,{httpOnly: true })

      res.redirect('/');
  } catch (err) {
        if (err.errorNum === 1) {
           // ORA-00001: unique constraint violated
        // res.status(400).send('Email already exists');
        res.render('signup.pug',{message:"Values Already Exists",display:'block'})
    } else {
        console.error(err);
        // res.status(500).send('Internal server error');
        res.render('signup.pug',{message:"Internal Server Error! Try Again After Some Time",display:'block'})
}
  }
});

app.post('/signin',async (req,res)=>{
  let stmnt
  let userType=req.body.userType
  let email=req.body.email
  try{
    const connection = await oracledb.getConnection(dbConfig);

    if (userType === "student") {
      stmnt = `SELECT * FROM students WHERE email = :email`;
    } else if (userType === "staff") {
      stmnt = `SELECT * FROM teachers WHERE email = :email`;
    } 
    const result=await connection.execute(stmnt,[email]);

    if ( result.rows.length===0){
      res.render('signin.pug',{message:'User Not Found! Please Try Again',display:'block'})
    }
    else{
    const user = result.rows[0];
    const pwd=user[8];
    if (pwd===req.body.password){

      //ssid generate
      ssid=create_session_id(email);
      await connection.execute(`UPDATE cookie SET session_id=:ssid where email=:email`,[ssid,email],{autoCommit:true});

      res.cookie('ssid',ssid,{ httpOnly: true })
      res.cookie('type',userType,{ httpOnly: true })

      //success
      res.redirect('/');
    }
    else{
      res.render('signin.pug',{message:'Wrong Password! Please Try Again',display:'block'})
    }}
  }catch(error){
    console.log(error);
    res.render('signin.pug',{message:'Internal Server Error! Try Again After Some Time',display:'block'})
  }

})

// Serve profile page
app.get('/profile', (req, res) => {
  res.sendFile(__dirname + '/static/profile.html');
});
// GET profile data
app.get('/profile-data', async (req, res) => {
  try {
      const connection = await oracledb.getConnection(dbConfig);
      let result;
      let ssid = req.cookies['ssid'];
      let email=get_email(ssid);
      let type=req.cookies['type'];

      if (type === 'student') {
          result = await connection.execute(
              `SELECT name, dob, gender, email, phone, admission_number, course, address FROM students WHERE email = :email`,
              [email]
          );
      } else {
          result = await connection.execute(
              `SELECT name, dob, gender, email, phone, position, branch, address FROM staff WHERE email = :email`,
              [email]
          );
      }

      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      const profileData = {
          name: user[0],
          dob: user[1],
          gender: user[2],
          email: user[3],
          phone: user[4],
          address: user[7],
          userType: type,
      };

      if (type === 'student') {
          profileData.admissionNumber = user[5];
          profileData.course = user[6];
      } else {
          profileData.position = user.POSITION;
          profileData.branch = user.BRANCH;
      }
      res.json(profileData);

  } catch (error) {
      console.error('Error fetching profile data:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/events', (req, res) => {
  res.sendFile(__dirname + '/static/events.html');
});

app.get('/resource',(req,res)=>{
  res.sendFile(__dirname + '/static/resource.html')
})

app.get('/schedule-resource',(req,res)=>{
  res.sendFile(__dirname + '/static/schedule-resource.html')
})

app.get('/available-times', async (req, res) => {
  const { resourceType, resourceDetails, selectedDate } = req.query; // Assuming selectedDate is in ISO format 'YYYY-MM-DD'
  
  try {
      const connection = await oracledb.getConnection(dbConfig);
      
      const query = `
          SELECT from_time, to_time
          FROM scheduled_resources
          WHERE resource_type = :resourceType
          AND resource_details = :resourceDetails
          AND booked_date =TO_TIMESTAMP_TZ(:selectedDate, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
      `;
      
      const result = await connection.execute(query, { resourceType, resourceDetails, selectedDate });
      const availableTimes = result.rows.map(row => ({
          fromTime: row[0].toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toTime: row[1].toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      
      res.json({ availableTimes });
      
  } catch (error) {
      console.error('Error fetching available times:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/schedule-resource', async (req, res) => {
  const { resourceType, resourceDetails, date, fromTime, toTime, purpose } = req.body;
  const userType = req.cookies['type'];
  let ssid = req.cookies['ssid'];
  const email = get_email(ssid);

  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const query = `
      INSERT INTO scheduled_resources (resource_type, resource_details, booked_date, from_time, to_time, purpose, user_type, email)
      VALUES (:resourceType, :resourceDetails, TO_DATE(:datee, 'YYYY-MM-DD'), TO_TIMESTAMP(:fromTime, 'YYYY-MM-DD HH24:MI:SS'), TO_TIMESTAMP(:toTime, 'YYYY-MM-DD HH24:MI:SS'), :purpose, :userType, :email)`;

    // Ensure fromTime and toTime include the date part for correct formatting
    const fullFromTime = `${date} ${fromTime}`;
    const fullToTime = `${date} ${toTime}`;

    const binds = {
      resourceType,
      resourceDetails,
      datee:date,
      fromTime: fullFromTime,
      toTime: fullToTime,
      purpose,
      userType,
      email
    };

    const result = await connection.execute(query, binds, { autoCommit: true });

    res.status(201).json({ message: 'Resource scheduled successfully', resource: { resourceType, resourceDetails, date, fromTime, toTime, purpose, userType, email } });
  } catch (error) {
    console.error('Error scheduling resource:', error);
    res.status(500).json({ message: 'Failed to schedule resource', error });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

app.get('/view-resource',(req,res)=>{
  res.sendFile(__dirname + '/static/view-resource.html')
});

app.get('/user-scheduled-resources', async (req, res) => {
  const email = get_email(req.cookies['ssid']);

  let connection;

  try {
      connection = await oracledb.getConnection(dbConfig);
      
      const query = `
          SELECT resource_type, resource_details, booked_date, TO_CHAR(from_time, 'HH24:MI') AS from_time, TO_CHAR(to_time, 'HH24:MI') AS to_time, purpose
          FROM scheduled_resources
          WHERE email = :email
          ORDER BY booked_date, from_time
      `;
      
      const result = await connection.execute(query, { email });
      const resources = await Promise.all(result.rows.map(async row => ({
        resource_type: row[0],
        resource_details: row[1],
        booked_date: row[2],
        from_time: row[3],
        to_time: row[4],
        purpose: await getClobAsString(row[5])
    })));

      res.json({ resources });
      
  } catch (error) {
      console.error('Error fetching user scheduled resources:', error);
      res.status(500).json({ error: 'Internal server error' });
  } finally {
      if (connection) {
          try {
              await connection.close();
          } catch (err) {
              console.error('Error closing connection:', err);
          }
      }
  }
});


app.get('/logout', (req, res) => {
  // Clear session data, destroy cookie, or perform necessary logout actions
  res.clearCookie('ssid');
  res.clearCookie('type');
  res.redirect('/');
});


app.get('/create-event',(req,res)=>{
  res.sendFile(__dirname+'/static/create-event.html');
})


app.post('/create-event', async (req, res) => {
  const { name, description, type, eventDate, resourceDetails, fromTime, toTime } = req.body;
  const email = get_email(req.cookies['ssid']);
  const userType = req.cookies['type'];
  const idd = get_number(); // Assuming get_number() generates a random number

  let connection;

  try {
      connection = await oracledb.getConnection(dbConfig);

      // Insert into scheduled_resources table
      const query1 = `
          INSERT INTO scheduled_resources (id, resource_type, resource_details, booked_date, from_time, to_time, purpose, user_type, email)
          VALUES (:idd, :type, :resourceDetails, TO_DATE(:eventDate, 'YYYY-MM-DD'), TO_TIMESTAMP(:fromTime, 'YYYY-MM-DD HH24:MI:SS'), TO_TIMESTAMP(:toTime, 'YYYY-MM-DD HH24:MI:SS'), :name, :userType, :email)
      `;

      const binds1 = {
          idd,
          type,
          resourceDetails,
          eventDate,
          fromTime: `${eventDate} ${fromTime}`,
          toTime: `${eventDate} ${toTime}`,
          name,
          userType,
          email
      };

      const result1 = await connection.execute(query1, binds1, { autoCommit: true });

      // Insert into events table
      const query2 = `
          INSERT INTO events (name, description, type, event_date, email, resource_id, user_type)
          VALUES (:name, :description, :type, TO_DATE(:eventDate, 'YYYY-MM-DD'), :email, :idd, :userType)
      `;

      const binds2 = {
          name,
          description,
          type,
          eventDate,
          email,
          idd,
          userType
      };

      const result2 = await connection.execute(query2, binds2, { autoCommit: true });

      res.redirect('/events');
  } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ message: 'Failed to create event', error });
  } finally {
      if (connection) {
          try {
              await connection.close();
          } catch (err) {
              console.error('Error closing connection:', err);
          }
      }
  }
});

app.get('/created-events',(req,res)=>{
  res.sendFile(__dirname+'/static/created-events.html');
})


app.get('/created-events-data', async (req, res) => {
  try {
      const connection = await oracledb.getConnection(dbConfig);
      const email=get_email(req.cookies['ssid']);
      const query = `
          SELECT e.name, e.description, e.type, e.event_date, e.email,
                 sr.resource_type, sr.resource_details, sr.booked_date, sr.from_time, sr.to_time, sr.purpose
          FROM events e
          INNER JOIN scheduled_resources sr ON e.resource_id = sr.id
          where e.email=:email
          ORDER BY e.event_date DESC
      `;
      const result = await connection.execute(query,{email});
      

      const events = await Promise.all(result.rows.map(async row => ({
        name: row[0],
        description:row[1], // Handle CLOB for description
        type: row[2],
        event_date: row[3],
        email: row[4],
        resource_type: row[5],
        resource_details: row[6],
        booked_date: row[7],
        from_time: row[8],
        to_time: row[9],
        purpose: await getClobAsString2(row[10]) // Handle CLOB for purpose
    })));
      await connection.close();
      res.json(events);
  } catch (error) {
      console.error('Error fetching created events:', error);
      res.status(500).json({ message: 'Failed to fetch created events', error });
  }
});


app.get('/all-events-data', async (req, res) => {
  try {
      const connection = await oracledb.getConnection(dbConfig);
      const query = `
            SELECT e.id AS eid, e.name, e.description, e.type, e.event_date, e.email, 
                   r.resource_details, r.from_time, r.to_time, 
                   COALESCE(reg.registration_count, 0) AS registrations
            FROM events e
            JOIN scheduled_resources r ON e.resource_id = r.id
            LEFT JOIN (
                SELECT event_id, COUNT(*) AS registration_count
                FROM registrations
                GROUP BY event_id
            ) reg ON e.id = reg.event_id
            ORDER BY e.event_date DESC
        `;

        const result = await connection.execute(query);
        const events = result.rows.map(row => ({
            eid: row[0],
            name: row[1],
            description: row[2],
            type: row[3],
            event_date: row[4],
            email: row[5],
            resource_details: row[6],
            from_time: row[7],
            to_time: row[8],
            registrations: row[9]
        }));

        res.json(events);

  } catch (error) {
      console.error('Error fetching created events:', error);
      res.status(500).json({ message: 'Failed to fetch created events', error });
  }
});

app.get('/registered-events',async (req,res)=>{
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const email=get_email(req.cookies['ssid']);
    const query = `
          select event_id
          from registrations where email_id=:email
      `;

      const result = await connection.execute(query,{email});
      const registeredEventIds = result.rows.map(row => row[0]);
      res.json(registeredEventIds);
        

  } catch (error) {
      console.error('Error fetching created events:', error);
      res.status(500).json({ message: 'Failed to fetch created events', error });
  }


})


app.post('/register-event',async (req,res)=>{
  try{
    const connection = await oracledb.getConnection(dbConfig);
    const email=get_email(req.cookies['ssid']);
    const {eid}=req.body;
    const query = `
            INSERT INTO registrations (email_id, event_id)
            VALUES (:email, :eid)
        `;
        
        const binds = {
            email: email,
            eid: eid
        };

        // Execute the query
        const result = await connection.execute(query, binds, { autoCommit: true });

        // Release the connection
        await connection.close();
        res.redirect('events');

    } catch (error) {
        console.error('Error registering event:', error);
        res.status(500).json({ error: 'Failed to register event' });
    }
});

app.get('/tasks',(req,res)=>{
  res.sendFile(__dirname+'/static/tasks.html');
})

app.get('/create-task',(req,res)=>{
  res.sendFile(__dirname+'/static/create-task.html');
})


app.post('/create-task', async (req, res) => {
  const { name, description, deadline, assigned_to } = req.body;
  const assigned_by = get_email(req.cookies['ssid']); // Function to get email from session/token

  try {
      const connection = await oracledb.getConnection(dbConfig);

      const query = `
          INSERT INTO tasks (name, description, deadline, assigned_to, assigned_by)
          VALUES (:name, :description, TO_DATE(:deadline, 'YYYY-MM-DD'), :assigned_to, :assigned_by)
          `;
      
      const binds = {
          name,
          description,
          deadline,
          assigned_to,
          assigned_by,
      };

      const result = await connection.execute(query, binds, { autoCommit: true });

      res.redirect('/tasks');
  } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ message: 'Failed to create task', error });
  }
});

app.get('/your-tasks-data', async (req, res) => {
  const email = get_email(req.cookies['ssid']); // Function to get email from session/token

  try {
      const connection = await oracledb.getConnection(dbConfig);

      const query = `
          SELECT id, name, description, deadline, assigned_to, assigned_by
          FROM tasks
          WHERE assigned_to = :email
      `;
      
      const result = await connection.execute(query, { email });

      const tasks = result.rows.map(row => ({
          id: row[0],
          name: row[1],
          description: row[2],
          deadline: new Date(row[3]), // Adjust format as needed
          assigned_to: row[4],
          assigned_by: row[5]
      }));

      res.json(tasks);
  } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Failed to fetch tasks', error });
  }
});

app.get('/created-tasks-data', async (req, res) => {
  try {
      // Get a connection to the database
      const connection = await oracledb.getConnection(dbConfig);

      // SQL query to fetch tasks
      const query = `
          SELECT id, name, description, deadline, assigned_to, assigned_by
          FROM tasks
          WHERE assigned_by = :email`; // Assuming email is passed as a parameter

      // Get the email from the session or request, however you manage it
      const email = get_email(req.cookies['ssid']); // Example: Fetch email from session or request

      // Execute the query with email as a parameter
      const result = await connection.execute(query, [email]);

      // Close the connection
      await connection.close();

      // Format the result rows
      const tasks = result.rows.map(row => ({
          taskId: row[0],
          name: row[1],
          description: row[2],
          deadline: row[3].toISOString(), // Convert to ISO format or any other format needed
          assign_to: row[4],
          assign_by: row[5]
      }));
      // Respond with JSON data
      res.json(tasks);

  } catch (error) {
      console.error('Error fetching created tasks:', error);
      res.status(500).json({ message: 'Failed to fetch created tasks', error });
  }
});

app.get('/created-tasks',(req,res)=>{
  res.sendFile(__dirname+'/static/created-tasks.html');
})


app.get('/task/:id', async (req, res) => {
  try {
      const connection = await oracledb.getConnection(dbConfig);
      const { id } = req.params;

      const query = `
          SELECT id, name, description, TO_CHAR(deadline, 'YYYY-MM-DD') as deadline
          FROM tasks
          WHERE id = :id
      `;

      const result = await connection.execute(query, [id]);

      if (result.rows.length === 0) {
          res.status(404).json({ message: 'Task not found' });
      } else {
          const task = result.rows[0];
          res.json({
              id: task[0],
              name: task[1],
              description: task[2],
              deadline: task[3]
          });
      }
  } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ message: 'Failed to fetch task', error });
  }
});


app.get('/edit-task', (req, res) => {
  res.sendFile(path.join(__dirname, '/static/edit-task.html')); 
});

app.put('/update-task/:id', async (req, res) => {
  try {
      const connection = await oracledb.getConnection(dbConfig);
      const { id } = req.params;
      const { name, description, deadline } = req.body;

      const query = `
          UPDATE tasks
          SET name = :name, description = :description, deadline = TO_DATE(:deadline, 'YYYY-MM-DD')
          WHERE id = :id
      `;

      await connection.execute(query, { name, description, deadline, id });
      await connection.commit();

      res.status(200).json({ message: 'Task updated successfully' });
  } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ message: 'Failed to update task', error });
  }
});

app.delete('/task/:id', async (req, res) => {
  try {
      const connection = await oracledb.getConnection(dbConfig);
      const { id } = req.params;

      const query = `
          DELETE FROM tasks
          WHERE id = :id
      `;

      await connection.execute(query, [id], { autoCommit: true });

      res.json({ message: 'Task deleted successfully' });
  } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ message: 'Failed to delete task', error });
  }
});


app.get('/calendar-data', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const email = get_email(req.cookies['ssid']);
    const { date } = req.query;

    // Fetch tasks created or assigned to the user with a deadline before or on the selected date
    const tasksQuery = `
      SELECT *
      FROM tasks
      WHERE (assign_by = :email OR assign_to = :email) AND deadline <= TO_DATE(:date, 'YYYY-MM-DD')
    `;
    const tasksResult = await connection.execute(tasksQuery, { email, date });

    // Fetch events created or registered by the user on the selected date
    const eventsQuery = `
      SELECT e.*
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE (e.email = :email OR r.email_id = :email) AND e.event_date = TO_DATE(:date, 'YYYY-MM-DD')
    `;
    const eventsResult = await connection.execute(eventsQuery, { email, date });

    // Fetch resources booked by the user on the selected date
    const resourcesQuery = `
      SELECT *
      FROM scheduled_resources
      WHERE email = :email AND booked_date = TO_DATE(:date, 'YYYY-MM-DD')
    `;
    const resourcesResult = await connection.execute(resourcesQuery, { email, date });

    console.log(tasksResult,eventsResult,resourcesResult)

    res.json({
      tasks: tasksResult.rows,
      events: eventsResult.rows,
      resources: resourcesResult.rows,
    });
    

    await connection.close();
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ message: 'Failed to fetch calendar data', error });
  }
});


app.get('/calendar', (req, res) => {
  res.sendFile(path.join(__dirname+'/static/calendar.html'));
});




app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});










app.get('/tasks-before-date', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const email = get_email(req.cookies['ssid']);
    const { date } = req.query;
    let datee=date;

    const query = `
      SELECT *
      FROM tasks
      WHERE (assigned_by = :email OR assigned_to = :email) AND deadline <= TO_DATE(:datee, 'YYYY-MM-DD')
    `;
    const result = await connection.execute(query, { email, datee });
    res.json(result.rows);

    await connection.close();
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Failed to fetch tasks', error });
  }
});

// Endpoint to fetch events on the selected date
app.get('/events-on-date', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const email = get_email(req.cookies['ssid']);
    const { date } = req.query;
    let datee=date;

    const query = `
      SELECT e.*
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE (e.email = :email OR r.email_id = :email) AND e.event_date = TO_DATE(:datee, 'YYYY-MM-DD')
    `;
    const result = await connection.execute(query, { email, datee });
    res.json(result.rows);

    await connection.close();
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Failed to fetch events', error });
  }
});

// Endpoint to fetch resources on the selected date

app.get('/resources-on-date', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const email = get_email(req.cookies['ssid']);
    const { date } = req.query;

    const query = `
      SELECT resource_type, resource_details, booked_date, from_time, to_time, purpose
      FROM scheduled_resources
      WHERE email = :email AND booked_date = TO_DATE(:datee, 'YYYY-MM-DD')
    `;

    const result = await connection.execute(query, { email, datee: date });

    const resources = await Promise.all(result.rows.map(async row => ({
      resource_type: row[0],
      resource_details: row[1],
      booked_date: row[2],
      from_time: row[3],
      to_time: row[4],
      purpose: await getClobAsString(row[5])
    })));
    res.json({ resources });

    await connection.close();
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ message: 'Failed to fetch resources', error });
  }
});




app.get("/communication",(req,res)=>{
  res.sendFile(__dirname+"/static/communications.html");
})






app.post('/send-communication', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const { title, message, recipient } = req.body;
    const sender = get_email(req.cookies['ssid']);

    const query = `
      INSERT INTO communications (title, message, sender, recipient)
      VALUES (:title, :message, :sender, :recipient)
    `;
    await connection.execute(query, { title, message, sender, recipient });
    await connection.commit();

    res.status(201).json({ message: 'Communication sent successfully' });
    await connection.close();
  } catch (error) {
    console.error('Error sending communication:', error);
    res.status(500).json({ message: 'Failed to send communication', error });
  }
});

app.get('/communications', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const email = get_email(req.cookies['ssid']);

    const query = `
      SELECT id, title, message, sender, recipient, timestamp
      FROM communications
      WHERE recipient = :email
      ORDER BY timestamp DESC
    `;
    const result = await connection.execute(query, { email });
    res.json(result.rows);
    await connection.close();
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ message: 'Failed to fetch communications', error });
  }
});

app.delete('/communications/:id', async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    const { id } = req.params;

    const query = `
      DELETE FROM communications
      WHERE id = :id
    `;
    await connection.execute(query, { id });
    await connection.commit();

    res.json({ message: 'Communication deleted successfully' });
    await connection.close();
  } catch (error) {
    console.error('Error deleting communication:', error);
    res.status(500).json({ message: 'Failed to delete communication', error });
  }
});


