const { urlencoded } = require('express');
const express = require('express');
const redis = require("redis");
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app= express();
const redisPort = 6379
const client = redis.createClient(redisPort);
const secretKey = 'password123123'

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


//log error to the console if any occurs
client.on("error", (err) => {
    console.log(err);
});
app.post('/login', async (req, res) => {
    const password = req.body.password;
    try {
        client.get(req.body.email, async (err, user) => {
            if (err) throw err;
            if (!user) {
                return res.status(500).send({message: 'Incorrect email.'});
            }
            user = JSON.parse(user)
            if (await bcrypt.compare(req.body.password, user.password)) {
                const accessToken = jwt.sign({
                    id: user.id,
                    email: user.email
                }, secretKey)
                return res.status(200).send({jwt: accessToken});    
            } else {
                return res.status(500).send({message: 'Incorrect password.'});
            }  
        })
    } catch (e) {
        res.status(500).send({message: e.toString()});
    }

})

app.post('/register', async (req, res) => {
    if (!req.body.password || !req.body.email) {
        res.status(500).send({message: 'Please send all required data.'});
        return;
    }
    try {
        client.get(req.body.email, async (err, user) => {
            if (err) throw err;
            if (user) {
                console.log('this user is already registered!')
                res.status(500).send({message: 'This email is already registered.'});
                return
            } else {
                console.log('registering new user');
                const hashedPassword  = await bcrypt.hash(req.body.password, 10)
                console.log(hashedPassword)
                const newUser = {
                    id: Date.now().toString(),
                    email: req.body.email,
                    password: hashedPassword
                }
                client.setex(req.body.email, 600, JSON.stringify(newUser));
                res.status(200).send({
                    user: {
                        id: newUser.id,
                        email: newUser.email
                    }
                });
            }
        })
    } catch (e) {
        console.log(e.toString())
        console.log('error in regidtering user')
        res.status(500).send({message: e.toString()});
    }

})
const tasks = [];

app.get('/user', authenticateToken, (req, res) => {
    return res.status(200).send({user: req.user}); 
})


app.post('/create-task', authenticateToken, (req, res) => {
    const user = req.user;
    try {
        const newTasks = {
            name: req.body.name,
            id: Date.now().toString()
        }
        userTasks = tasks.find(task => task.userId === user.id)
        if (userTasks) {
            userTasks.tasks.push(newTasks)
        } else {
            tasks.push({
                userId: user.id,
                tasks: [newTasks]
            })
        }
        return res.status(200).send({task: newTasks}); 
    } catch (e) {
        res.status(500).send({message: e.toString()});
    }
})


app.get('/list-tasks', authenticateToken, (req, res) => {
    const user = req.user;
    try {
        userTasks = tasks.find(task => task.userId === user.id)
        if (!userTasks) {
            return res.status(200).send({tasks: []});
        } else {
            return res.status(200).send({tasks: userTasks.tasks}); 
        }
    } catch (e) {
        res.status(500).send({message: e.toString()});
    }
})

function authenticateToken (req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) return res.status(401).send('Forbidden')
    jwt.verify(token, secretKey, (err, user) =>{
        if (err) return res.status(401).send('Forbidden')
        req.user = user
        next()
    })
}
app.listen(8085);