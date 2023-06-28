const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

//!!middleware

app.use(cors());
app.use(express.json());

//* security layer "jwt"
//* email same
//* check admin

//??.............. verifyJWT
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({
      error: true,
      message: "unauthorized access token Please verifyJWT",
    });
  }

  // bearer token
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.exiwnj2.mongodb.net/?retryWrites=true&w=majority`;

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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const menuCollection = client.db("bistroDB").collection("menu");
    const reviewsCollection = client.db("bistroDB").collection("reviews");
    const cartCollection = client.db("bistroDB").collection("cart");
    const usersCollection = client.db("bistroDB").collection("users");
    const reservationCollection = client.db("bistroDB").collection("reservation");

    //??................verifyAdmin
    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
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

    //?? ................users related apis............
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
      console.log(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user.email };
      const existing = await usersCollection.findOne(query);
      // console.log("existing user", existing);
      if (existing) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin/:adID", async (req, res) => {
      const id = req.params.adID;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: `admin`,
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

    //?..................Menu related apis
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.post("/menu",async (req, res) => {
      const newItem = req.body
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    });
    app.delete("/menu/:productId",  async (req, res) => {
      const id = req.params.productId;
      const query = { _id: id };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
      // console.log(id);
    });
  //?..................Reservation related apis
  app.post("/reservation", async (req, res) => {
    const item = req.body;
    const result = await reservationCollection.insertOne(item);
    res.send(result);
  });
  app.get("/reservation", verifyJWT, async (req, res) => {
      
    const email = req.query.email;
    // console.log(email);
    if (!email) {
      return res.status(400).send("Email parameter is missing or empty.");
    }

    const decodedEmail = req.decoded.email;
    if (email !== decodedEmail) {
      return res
        .status(403)
        .send({ error: true, message: "forbidden access" });
    }
    const query = { email: email };
    try {
      const result = await reservationCollection.find(query).toArray();
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
  app.delete("/reservation/:productId",  async (req, res) => {
    const id = req.params.productId;
    const query = { _id: new ObjectId(id) };
    const result = await reservationCollection.deleteOne(query);
    res.send(result);
    // console.log(id);
  });

  //?..................Reviews related apis
  app.get("/reviews", async (req, res) => {
    const result = await reviewsCollection.find().toArray();
    res.send(result);
  });
   app.get("/reviews", verifyJWT, async (req, res) => {
      
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        return res.status(400).send("Email parameter is missing or empty.");
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      try {
        const result = await reviewsCollection.find(query).toArray();
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
    app.post("/reviews", async (req, res) => {
      const item = req.body;
      const result = await reviewsCollection.insertOne(item);
      res.send(result);
    });

    //?..................cart collection APIS
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.get("/carts", verifyJWT, async (req, res) => {
      
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        return res.status(400).send("Email parameter is missing or empty.");
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
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
      const query = { _id: id };
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
  res.send("boss is sitting");
});
app.listen(port, () => {
  console.log(`Bisrto boss is sitting on port ${port}`);
});

/**
 * --------------------------------
 *      NAMING CONVENTION
 * --------------------------------
 * users : userCollection
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.patch('/users/:id')
 * app.put('/users/:id')
 * app.delete('/users/:id')
 */
