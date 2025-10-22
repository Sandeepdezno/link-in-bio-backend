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
                links: links,
                email: user.email
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
                { userId: user.id, email: user.email },
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


});

app.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const user = await knex('users').where('id', req.user.userId).first();
        if (user) {
            const links = await knex('links').where('userId', user.id);
            const userProfile = {
                name: user.name,
                bio: user.bio,
                profilePictureUrl: user.profilePictureUrl,
                links: links,
                email: user.email
            };
            return res.json(userProfile);
        } else {
            return res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Remove or comment out this old GET route if it exists:
// app.get('/edit-profile', authenticateToken, async (req, res) => { ... });

// Add this new PUT route:
app.put('/edit-profile', authenticateToken, async (req, res) => {
    try {
        const { name, bio, links } = req.body; // Get updated data from request body

        // --- Update User Table ---
        // Validate name and bio if needed
        if (name === undefined || bio === undefined) {
            return res.status(400).json({ error: 'Name and bio are required.' });
        }
        await knex('users')
            .where('id', req.user.userId) // Use the userId from the verified token
            .update({ name: name, bio: bio });

        // --- Update Links Table ---
        // 1. Delete existing links for this user
        await knex('links').where('userId', req.user.userId).del();

        // 2. Insert new links if provided and valid
        if (links && Array.isArray(links) && links.length > 0) {
            // Filter out any empty links before inserting
            const validLinks = links.filter(link => link.title && link.url);
            if (validLinks.length > 0) {
                const linkData = validLinks.map(link => ({
                    userId: req.user.userId,
                    title: link.title,
                    url: link.url
                }));
                await knex('links').insert(linkData);
            }
        }

        res.json({ success: true, message: 'Profile updated successfully.' });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Get token part

    if (!token) {
        // If no token, send 401 Unauthorized and stop
        return res.status(401).json({ error: 'Token Missing' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // If token is invalid (expired, wrong signature), send 403 Forbidden
            console.error('JWT Verification Error:', err); // Log the error for debugging
            return res.status(403).json({ error: 'Invalid or Expired Token' });
        }
        // If token is valid, the 'user' variable contains the decoded payload 
        // (e.g., { userId: 1, email: '...' })
        req.user = user; // Attach user payload to the request object
        next(); // IMPORTANT: Call next() to proceed to the route handler
    });
}

app.listen(port, () => {
    console.log('Server is running at: http://localhost:3001');
})

