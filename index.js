require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("CheckShelf server is running");
});

// Replace the old SRV URI with this expanded version
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.au1728f.mongodb.net/?appName=Cluster0`;

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.au1728f.mongodb.net/?appName=Cluster0`;

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-3bemznd-shard-00-00.au1728f.mongodb.net:27017,ac-3bemznd-shard-00-01.au1728f.mongodb.net:27017,ac-3bemznd-shard-00-02.au1728f.mongodb.net:27017/?ssl=true&replicaSet=atlas-fg9v2y-shard-0&authSource=admin&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // collections of books, courses, instructors
    const booksCollection = client.db("checkShelfDB").collection("books");
    const coursesCollection = client.db("checkShelfDB").collection("courses");
    const instructorsCollection = client
      .db("checkShelfDB")
      .collection("instructors");

    // Books API

    // get all the books
    app.get("/books", async (req, res) => {
      const result = await booksCollection.find().toArray();
      res.send(result);
    });

    // single book using dynamic route
    app.get("/books/:id", async (req, res) => {
      const { id } = req.params;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.findOne(query);
      res.send(result);
    });

    app.post("/books", async (req, res) => {
      const bookData = req.body;
      const result = await booksCollection.insertOne(bookData);
      res.send(result);
    });

    // Courses API

    // get all the courses
    app.get("/courses", async (req, res) => {
      const result = await coursesCollection.find().toArray();
      res.send(result);
    });

    // single course using dynamic route
    app.get("/courses/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await coursesCollection.findOne(query);
      res.send(result);
    });

    // instructors API

    // get all the instructors
    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    });

    // single instructor using dynamic route
    app.get("/instructors/:id", async (req, res) => {
      const { id } = req.params;
      const query = {
        insID: id,
      };
      const result = await instructorsCollection.findOne(query);
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`App is running from port ${port}`);
});
