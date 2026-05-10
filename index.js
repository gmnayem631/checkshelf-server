require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { GoogleGenAI } = require("@google/genai");

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
const mongoClient = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // collections of books, courses, instructors
    const booksCollection = mongoClient.db("checkShelfDB").collection("books");
    const coursesCollection = mongoClient
      .db("checkShelfDB")
      .collection("courses");
    const instructorsCollection = mongoClient
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

    // book recommendation by AI
    app.post("/aiRecommendation", async (req, res) => {
      try {
        const { topic, level, rating } = req.body;

        // 1. Validate inputs
        if (!topic || !level || !rating) {
          return res
            .status(400)
            .json({ error: "topic, level, and rating are required." });
        }

        // 2. Fetch only relevant books from MongoDB (lean payload)
        const filteredBooks = await booksCollection
          .find(
            { level: level, tags: { $in: [topic] } },
            { projection: { _id: 1, title: 1, level: 1, tags: 1 } },
          )
          .toArray();

        if (filteredBooks.length === 0) {
          return res
            .status(404)
            .json({ error: "No books found matching your criteria." });
        }

        // 3. Build lean inventory for Gemini
        const inventory = filteredBooks.map((b) => ({
          id: b._id.toString(),
          title: b.title,
          level: b.level,
          tags: b.tags,
        }));

        // 4. Build prompt
        const prompt = `
You are a chess book recommendation engine.
A user wants book recommendations based on their profile.

User Profile:
- Chess.com Rapid Rating: ${rating}
- Topic of Interest: ${topic}
- Skill Level: ${level}

Available Books (already filtered for relevance):
${JSON.stringify(inventory)}

TASK: Select the 2 most suitable books for this user.
RULES:
- Return ONLY a raw JSON array of exactly 2 book ID strings.
- No explanation, no markdown, no code fences, no extra text.
- Example of valid response: ["683a1f77bcf86cd799439011", "683a1f77bcf86cd799439012"]
    `.trim();

        // 5. Call Gemini
        const result = await aiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const aiResponseText = result.text;

        // 6. Parse safely
        let recommendedIds;
        try {
          // Strip markdown fences if Gemini wraps in ```json ... ```
          let cleaned = aiResponseText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

          // Fallback: extract first [...] array if extra text sneaks in
          if (!cleaned.startsWith("[")) {
            const match = cleaned.match(/\[[\s\S]*\]/);
            if (!match) throw new Error("No JSON array found in AI response.");
            cleaned = match[0];
          }

          recommendedIds = JSON.parse(cleaned);

          if (!Array.isArray(recommendedIds) || recommendedIds.length === 0) {
            throw new Error("AI returned invalid or empty array.");
          }
        } catch (parseError) {
          console.error("AI response parse failed:", parseError.message);
          console.error("Raw AI response was:", aiResponseText);
          return res
            .status(500)
            .json({ error: "AI returned an unexpected response format." });
        }

        // 7. Safe ObjectId mapping — skip invalid IDs instead of crashing
        const validObjectIds = recommendedIds
          .filter((id) => typeof id === "string" && ObjectId.isValid(id))
          .map((id) => new ObjectId(id));

        if (validObjectIds.length === 0) {
          return res
            .status(500)
            .json({ error: "AI returned no valid book IDs." });
        }

        // 8. Fetch full book objects from MongoDB
        const recommendedBooks = await booksCollection
          .find({ _id: { $in: validObjectIds } })
          .toArray();

        res.json(recommendedBooks);
      } catch (error) {
        console.error("AI Recommendation Error:", error);

        if (error?.status === 429) {
          return res.status(429).json({
            error: "quota_exceeded",
            message: "AI is temporarily busy. Please try again shortly.",
          });
        }

        res.status(500).json({ error: "AI failed to process the request." });
      }
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
    await mongoClient.connect();
    // Send a ping to confirm a successful connection
    await mongoClient.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the mongoClient will close when you finish/error
    // await mongoClient.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`App is running from port ${port}`);
});
