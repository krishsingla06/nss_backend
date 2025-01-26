import express from "express";
const app = express();
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = "12345";

const PORT = 8000;
const uri = `mongodb://127.0.0.1:27017`;
import { MongoClient } from "mongodb";
import cors from "cors";
const client = new MongoClient(uri);
await client.connect();
const corsOptions = {
  origin: "http://localhost:3000",
  method: "GET, POST, PUT, DELETE",
  credentials: true,
};

app.use(express.json());
app.use(cors(corsOptions));

app.get("/", (req, res) => {
  console.log("path = /");
  res.status(200);
  res.send("Welcome to root URL of Server updated");
});

//End point to fetch all the tests data for a student
app.post("/getstudentdata", async (req, res) => {
  console.log("called getstudentdata");
  try {
    const studentname = req.body.namee;
    const db = client.db("Jee");
    const coll = db.collection(`${studentname}`);
    const cursor = coll.find();
    const studentdata = [];
    for await (const doc of cursor) {
      studentdata.push(doc);
    }
    console.log(studentname);
    console.log(studentdata);
    res
      .status(200)
      .send({ message: "Student data fetched successfully", studentdata });
  } catch (error) {
    console.log(error);
  }
});

app.post("/getadmindata", async (req, res) => {
  console.log("called getadmindata");
  try {
    const studentname = req.body.namee;
    const db = client.db("Jee");
    const coll = db.collection(`main`);
    const cursor = coll.find();
    const admindata = [];
    for await (const doc of cursor) {
      admindata.push(doc);
    }
    const userlist = [];
    const userscoll = db.collection("users");
    const cursor1 = userscoll.find();
    for await (const doc of cursor1) {
      userlist.push(doc);
    }
    console.log(studentname);
    console.log(admindata);
    res.status(200).send({
      message: "Student data fetched successfully",
      admindata: admindata,
      userlist: userlist,
    });
  } catch (error) {
    console.log(error);
  }
});

//End point to start test, so it will recieve student name,test num,start time
app.post("/starttest", async (req, res) => {
  //vese start hote hii questions bhejunga aur start = true kar dunga aur start kar dunga
  try {
    const studentname = req.body.namee;
    const testnum = parseInt(req.body.testnum);
    const starttime = req.body.starttime;
    const db = client.db("Jee");
    const coll = db.collection(`${studentname}`);
    const cursor = coll.find({ testnum: testnum });
    //if its start time is already set then we will not update it
    for await (const doc of cursor) {
      if (doc.started) {
        res.status(200).send({
          message: "Test already started, cannot start again",
        });
        return;
      }
    }

    //then firstly fetch questions and options from the main collection and then insert it into the student collection

    const maincoll = db.collection("main");
    const maincursor = maincoll.find({ testnum: testnum });
    let questions = [];
    for await (const doc of maincursor) {
      questions = doc.questions;
    }

    console.log("setting ans to -1");
    for (let i = 0; i < questions.length; i++) {
      questions[i].ans = await Promise.resolve(-1);
    }
    console.log("set ans to -1");

    console.log(questions);

    const result = await coll.updateOne(
      { testnum: testnum },
      { $set: { starttime: starttime, questions: questions, started: true } }
    );
    //console.log(studentname);

    //console.log(studentdata);
    res.status(200).send({
      message: "Test started successfully",
      questions: questions,
    });
    // res
    //   .status(200)
    //   .send({ message: "Student data fetched successfully", result });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error", error });
  }
});

//End point to start test, so it will recieve student name,test num,start time
app.post("/endtest", async (req, res) => {
  console.log("called endtest");
  //end time update karna hai, finish = true karna hai , aur answers bhi bhejna hai
  try {
    const studentname = req.body.namee;
    const testnum = parseInt(req.body.testnum);
    const endtime = req.body.endtime;
    const markedarray = req.body.markedarray;

    const db = client.db("Jee");
    const coll = db.collection(`${studentname}`);
    const cursor = coll.find({ testnum: testnum });
    //if its start time is already set then we will not update it
    for await (const doc of cursor) {
      if (doc.finished) {
        res.status(200).send({
          message: "Test already finished, cannot finish again",
        });
        return;
      }
    }

    //Update the endtime and finish flag
    // for each question update the marked option

    // await coll.updateOne(
    //   { testnum: testnum },
    //   { $set: { finishtime: endtime, finished: true } }
    // );

    // use cursor to update the marked option for each question and finished and finishtime

    // cursor will only point to one question paper, so update its finish time and finish flag

    const result = await coll.updateOne(
      { testnum: testnum },
      { $set: { finishtime: endtime, finished: true } }
    );

    //Update the marked option for each question

    for (let i = 0; i < markedarray.length; i++) {
      const result = await coll.updateOne(
        { testnum: testnum },
        { $set: { [`questions.${i}.marked`]: markedarray[i] } }
      );
    }

    //now i will see in main collection for answers and then send the answers to the student
    const maincoll = db.collection("main");
    const maincursor = maincoll.find({ testnum: testnum });
    // answers are in questions array of the main collection .ans field

    let answers = [];

    for await (const doc of maincursor) {
      answers = doc.questions;
    }

    //update the answers in the student collection

    for (let i = 0; i < answers.length; i++) {
      await coll.updateOne(
        { testnum: testnum },
        { $set: { [`questions.${i}.ans`]: answers[i].ans } }
      );
    }

    //now i will send the question array to the student
    const cursor1 = coll.find({ testnum: testnum });
    let questions = [];
    for await (const doc of cursor1) {
      questions = doc.questions;
    }

    console.log(questions);

    res.status(200).send({
      message: "Test ended successfully",
      questions: questions,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error", error });
  }
});

app.post("/saveresponse", async (req, res) => {
  console.log("called save response");
  const marked = await req.body.selectedOption;
  const testnum = parseInt(await req.body.testnum); // Ensure `testnum` is passed and parsed
  const questionnum = parseInt(await req.body.questionnum); // Ensure `questionnum` is passed and parsed
  const studentname = await req.body.namee; // Assuming `studentname` is passed in the request

  try {
    const db = await client.db("Jee");
    console.log("studentname", studentname);
    const coll = await db.collection(`${studentname}`);
    const result = await coll.updateOne(
      { testnum: testnum }, // Match the document with the specified testnum
      { $set: { [`questions.${questionnum}.marked`]: marked } } // Update using dot notation
    );

    console.log("Updated marked option:", result);

    res.status(200).json({ message: "Marked option updated successfully!" });
  } catch (error) {
    console.error("Error updating marked option:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

// Route to handle user registration (Sign-up)
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const db = client.db("Jee");
  const usersCollection = db.collection("users");

  try {
    // Check if user already exists in the database
    const userExists = await usersCollection.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store the user in the database
    const newUser = { username, password: hashedPassword };
    await usersCollection.insertOne(newUser);

    // Respond with success
    res.status(200).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

app.post("/signupadmin", async (req, res) => {
  const { username, password } = req.body;
  const db = client.db("Jee");
  const usersCollection = db.collection("admins");

  try {
    // Check if user already exists in the database
    const userExists = await usersCollection.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store the user in the database
    const newUser = { username, password: hashedPassword };
    await usersCollection.insertOne(newUser);

    // Respond with success
    res.status(200).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

// Route to handle user login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const db = client.db("Jee");
  const usersCollection = db.collection("users");

  try {
    // Find the user by username in the database
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Compare the password with the hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    // Generate JWT token for authentication
    const token = jwt.sign({ username: user.username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Respond with the token
    res.status(200).json({ message: "Login successful", token, username });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

// Route to handle user login
app.post("/loginadmin", async (req, res) => {
  const { username, password } = req.body;
  const db = client.db("Jee");
  const usersCollection = db.collection("admins");

  try {
    // Find the user by username in the database
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Compare the password with the hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    // Generate JWT token for authentication
    const token = jwt.sign({ username: user.username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Respond with the token
    res.status(200).json({ message: "Login successful", token, username });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

// Start the Express server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
});
