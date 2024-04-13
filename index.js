
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;




app.use(cors({
    origin: [
        'http://localhost:5173'
        // 'https://libary-manage.web.app',
        // 'https://libary-manage.firebaseapp.com'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hq29e8f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

//  middle ware 
const logger = (req, res, next) => {
    console.log('log info:', req.method, req.url);
    next();
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ massage: 'unauthorized access' });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ massage: 'unauthorized access' });
        }
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect()
        const productCollection = client.db('weShopDB').collection('product');
        const userCollection = client.db('weShopDB').collection('user');
        const reviewCollection = client.db('weShopDB').collection('review');
        const cartCollection = client.db('weShopDB').collection('cart');
        const orderCollection = client.db('weShopDB').collection('order');


        // jwt related
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log('user for token', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true });
        })

        // User Collection
        app.post('/users', async (req, res) => {
            const user = req.body;
            // unique one email one time
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        })
        app.get('/users', logger, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // Product Collection
        app.post('/products', logger, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })
        app.get('/products', logger, async (req, res) => {
            const result = await productCollection.find().toArray();
            res.send(result);
        })
        // Product Collection
        app.post('/reviews', logger, async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })
        app.get('/reviews', logger, async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })

        app.post('/carts', logger, async (req, res) => {
            const { clientEmail, title } = req.body;

            // Check if the clientEmail is valid
            if (!clientEmail || clientEmail.length === 0) {
                return res.status(400).json({ message: 'Invalid clientEmail' });
            }

            // Check if the title is valid
            if (!title || title.length === 0) {
                return res.status(400).json({ message: 'Invalid title' });
            }

            // Check if the clientEmail has already selected the same title
            const existingProduct = await cartCollection.findOne({ clientEmail, title });
            if (existingProduct) {
                return res.send({ message: 'removed' });
            }

            // Check if the clientEmail has selected more than 4 products
            const productCount = await cartCollection.countDocuments({ clientEmail });
            if (productCount >= 4) {
                return res.status(409).json({ message: 'Client has already selected maximum number of products' });
            }

            // If all checks pass, insert the new product into the collection
            const newProduct = { ...req.body };
            const result = await cartCollection.insertOne(newProduct);
            res.status(201).json(result);
        });


        app.get('/carts', logger, async (req, res) => {
            const result = await cartCollection.find().toArray();
            res.send(result);
        })

        app.get('/cartsUser/:email', async (req, res) => {
            const email = req.params.email;
            const query = { clientEmail: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/cartsUser/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // Order Collection
        app.post('/orders', async (req, res) => {
            const payment = req.body;
            const paymentResult = await orderCollection.insertOne(payment);

            const query = {_id: {
                $in: payment.cartId.map(id => new ObjectId(id))
            }}

            const deleteResult = await cartCollection.deleteMany(query)

            console.log("payment info", payment);
            res.send({paymentResult, deleteResult})
        });
        
        app.get('/ordersUser/:email', async (req, res) => {
            try {
                // Extract email and filter from request parameters and query
                const { email } = req.params;
                const { sort } = req.query;
        
                // Construct query to find orders for the specified email
                const query = { orderEmail: email };
        
                // Construct options object for sorting
                const options = {
                    sort: {
                        date: sort === 'asc' ? 1 : -1 // Invert sorting order if 'asc' is provided
                    }
                };
        
                // Fetch orders from the database
                const result = await orderCollection.find(query, options).toArray();
        
                // Send the result as response
                res.send(result);
            } catch (error) {
                console.error('Error fetching orders:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        
        app.get('/orders', async (req, res) => {
            const filter = req.query;
            const options = {
                sort: {
                    date: filter.sort == 'asc' ? -1 : 1
                }
            }
            const result = await orderCollection.find(options).toArray();
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('weShop Server Running');
})
app.listen(port, () => {
    console.log(`weShop Running From ${port}`);
})
