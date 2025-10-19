const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const port = 3001;

const app = express();

app.use(cors());
app.use(express.json());

const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: './database.sqlite',
    },
    useNullAsDefault: true
});

const JWT_SECRET = 'ddc57013bd79490e3d363c85043e8669';

app.get('/', async (req, res) => {
    try {
        const user = await knex('users').first();
        if (user) {
            const links = await knex('links').where('userId', user.id);
            const userProfile = {
                name: user.name,
                bio: user.bio,
                profilePictureUrl: user.profilePictureUrl,
                links: links
            };
            res.json(userProfile);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.post('/register', async (req, res) => {
    const { email, password, name, bio, profilePictureUrl } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userId] = await knex('users').insert({
            email: email,
            password: hashedPassword,
            name: name,
            bio: bio,
            profilePictureUrl: profilePictureUrl
        });
        res.status(201).json({ success: true, userId: userId });
    }

    catch (error) {
        if (error.code == 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Email Already Registered.' });
        }
        console.error('Error registering user: ', error);
        res.status(500).json({ error: 'Failed to Register user' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    try {
        const user = await knex('users').where('email', email).first();
        if (user && await bcrypt.compare(password, user.password)) {
            //Generate Token
            const token = jwt.sign(
                { useId: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: '1h' }
            );
            res.json({ success: true, token: token });
        }
        else {
            return res.status(401).json({ error: 'Invalid Email or Password' });
        }
    }
    catch (error) {
        console.error('Error during login: ', error)
        res.status(500).json({ error: 'Login Failed' });
    }


})

app.listen(port, () => {
    console.log('Server is running at: http://localhost:3001');
})

