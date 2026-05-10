require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createClient } = require("@google/genai");

// 1. Initialize the client
const client = createClient({ apiKey: process.env.GEMINI_API_KEY });

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
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.findOne(query);
      res.send(result);
    });

    // add book from frontend request
    app.post("/books", async (req, res) => {
      const bookData = req.body;
      const result = await booksCollection.insertOne(bookData);
      res.send(result);
    });

    // book recommendation through Google Gemini AI
    app.post("/aiRecommendation", async (req, res) => {
      const { topic, level, rating } = req.body;
      const allBooks = await booksCollection.find().toArray();

      // providing the IDs and Titles of books to AI
      const inventory = allBooks.map((b) => ({
        id: b._id.toString(), // Convert ObjectId to string
        title: b.title,
        level: b.level,
        tags: b.tags,
      }));

      const response = await client.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a Chess Master recommendation engine. 
                    User Profile: Rating ${rating}, Topic: ${topic}, Experience: ${level}.
                    
                    Inventory: ${JSON.stringify(inventory)}
                    
                    TASK: Select the 2 best books from the inventory.
                    OUTPUT: Return ONLY a JSON array of the book IDs.
                    FORMAT: ["id1", "id2"]`,
              },
            ],
          },
        ],
      });

      // Parse the AI response (cleaning off any markdown triple backticks)
      const aiResponseText = response.candidates[0].content.parts[0].text;
      const cleanJson = aiResponseText.replace(/```json|```/g, "").trim();
      const recommendedIds = JSON.parse(cleanJson);

      // Fetch the FULL book objects from the DB using those IDs
      const recommendedBooks = await booksCollection
        .find({
          _id: { $in: recommendedIds.map((id) => new ObjectId(id)) },
        })
        .toArray();

      res.send(recommendedBooks);
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
