const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require('sslcommerz-lts')
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");



const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.exiwnj2.mongodb.net/?retryWrites=true&w=majority`;

const corsOptions = {
  origin: ["http://localhost:5173", "https://bistro-boss-e6319.web.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false //true for live, false for sandbox

// Middleware to verify JWT
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({
      error: true,
      message: "Unauthorized access token. Please verifyJWT.",
    });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access." });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const menuCollection = client.db("bistroDB").collection("menu");
    const reviewsCollection = client.db("bistroDB").collection("reviews");
    const cartCollection = client.db("bistroDB").collection("cart");
    const usersCollection = client.db("bistroDB").collection("users");
    const reservationCollection = client
      .db("bistroDB")
      .collection("reservation");

    // Middleware to verify admin role
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access." });
      }
      next();
    };

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Users related APIs
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existing = await usersCollection.findOne(query);
      if (existing) {
        return res.send({ message: "User already exists." });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin/:adID", async (req, res) => {
      const id = req.params.adID;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/admin/:adID", async (req, res) => {
      const id = req.params.adID;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: true });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // Menu related APIs
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    });

    app.delete("/menu/:productId", async (req, res) => {
      const id = req.params.productId;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // Reservation related APIs
    app.post("/reservation", async (req, res) => {
      const item = req.body;
      const result = await reservationCollection.insertOne(item);
      res.send(result);
    });

    app.get("/reservation", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send("Email parameter is missing or empty.");
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access." });
      }

      const query = { email: email };
      try {
        const result = await reservationCollection.find(query).toArray();
        if (result.length === 0) {
          return res
            .status(404)
            .send("No reservation records found for the provided email.");
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching reservation data:", error);
        res.status(500).send("Internal server error");
      }
    });

    app.delete("/reservation/:productId", async (req, res) => {
      const id = req.params.productId;
      const query = { _id: new ObjectId(id) };
      const result = await reservationCollection.deleteOne(query);
      res.send(result);
    });

    // Reviews related APIs
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    app.get("/reviews", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send("Email parameter is missing or empty.");
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access." });
      }

      const query = { email: email };
      try {
        const result = await reviewsCollection.find(query).toArray();
        if (result.length === 0) {
          return res
            .status(404)
            .send("No reviews found for the provided email.");
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching reviews data:", error);
        res.status(500).send("Internal server error");
      }
    });

    app.post("/reviews", async (req, res) => {
      const item = req.body;
      const result = await reviewsCollection.insertOne(item);
      res.send(result);
    });

    // Cart collection APIs
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send("Email parameter is missing or empty.");
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access." });
      }

      const query = { email: email };
      try {
        const result = await cartCollection.find(query).toArray();
        if (result.length === 0) {
          return res
            .status(404)
            .send("No cart records found for the provided email.");
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching cart data:", error);
        res.status(500).send("Internal server error");
      }
    });

    app.delete("/carts/:productId", async (req, res) => {
      const id = req.params.productId;
      const query = { _id:id };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Bistro boss is sitting");
});

app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`);
});
//  * --------------------------------
//  *      NAMING CONVENTION
//  * --------------------------------
//  * users : userCollection
//  * app.get('/users')
//  * app.get('/users/:id')
//  * app.post('/users')
//  * app.patch('/users/:id')
//  * app.put('/users/:id')
//  * app.delete('/users/:id')
//  */
