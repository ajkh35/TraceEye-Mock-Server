const express = require('express');
const app = express();
const port = 3000;
const bodyParser = require('body-parser');
const FCM = require('fcm-push');
const morgan = require('morgan');
const mysql = require('mysql');

// fcm setup
const server_key = 'AAAAK6UBv5g:APA91bH3QW-tRFgJuthXwlY2vuvhgq03oZKvt4Oxx1oMcPWcrcAx1sQIVl2mz5mucWGOpEagODO48WHlaJB9DnXZ6kZEHjmwRIkHLpV8p5ho5dzNadZ47tlbou1W5jIEIcwaSRtd9Wgz';
const fcm = new FCM(server_key);

// Database setup
const conn = mysql.createConnection({
	host: 'localhost',
	user: 'ajay',
	password: 'password',
	database: 'mydb'
});

conn.connect(function(err){
	if(err) throw err;
	console.log("Connected!");
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(morgan('combined'));

// Save location route
app.post('/location', (req,res) => {
	if(req.body !== null){
		let success = true;
		let query1 = 'update user set lat = ? where id = '+req.body.id;
		conn.query(query1, req.body.lat, (err, result) => {
			if(err) success = false;
			console.log('latitude updated');
		});
		let query2 = 'update user set lng = ? where id = '+req.body.id;
		conn.query(query2, req.body.lng, (err, result) => {
			if(err) success = false;
			console.log('longitude updated');
		});
		if(success)
			res.send('location saved');
		else
			res.send('location not saved');
	}
});


// Login route
app.post('/login', (req,res) => {
	let query = 'select * from user where email = ?';
	conn.query(query, req.body.email, (err,result) => {
		if(result.length > 0){
			if(req.body.password == result[0].password){
				res.send(result[0]);
			} else {
				res.status(422).send('Wrong password');
			}
		} else {
			res.status(422).send('Wrong email');
		}
	});
});

// Save Notification token
app.post('/notification_token', (req,res) => {
	let query = 'update user set fcm_token = ?  where id = ?';
	conn.query(query, [req.body.token,req.body.id], (err,result) => {
		if(result.affectedRows > 0){
			res.send('Token saved');
		} else {
			res.send('User not found');
		}
	});
});

// Get friends
app.get('/friends', (req,res) => {
	// find friends
	let idArray = [];
	let query = 'select * from friends where id1 = ? OR id2 = ?';
	conn.query(query, [req.query.id,req.query.id], (err,result) => { 
		if(result.length > 0){ 
			for(var i=0;i<result.length;i++){
				if(result[i].id1 == req.query.id){
					idArray.push(result[i].id2);
					continue;
				}
				if(result[i].id2 == req.query.id){
					idArray.push(result[i].id1);
					continue;
				}
			}

			// send friends details
			let friends = [];
			idArray.forEach(function(value) {
				let query = 'select * from user where id = ?';
				conn.query(query, value, (err,result) => {
					if(result.length > 0){
						friends.push(result[0]);
						if(friends.length == idArray.length) {
							res.send(friends);
						}
					} else {
						res.send('Server side error');
					}
				});
			});
		} else {
			res.send('User not found');
		}	
	});
});

// Notification request
app.post('/notify', (req,res) => {
	// find the friends
	let idArray = [];
	let query = 'select * from friends where id1 = ? OR id2 = ?';
	conn.query(query, [req.body.id,req.body.id], (err,result) => {
		if(result.length > 0){
			for(var i=0;i<result.length;i++){
				if(result[i].id1 == req.body.id){
					idArray.push(result[i].id2);
					continue;
				}
				if(result[i].id2 == req.body.id){
					idArray.push(result[i].id1);
					continue;
				}
			}

			// send notification one by one
			idArray.forEach(function(value){
				let query = 'select fcm_token from user where id = ?';
				conn.query(query, value, (err,result) => {
					if(result.length > 0){
						let message = {
							to: result[0].fcm_token,
							collapse_key: value.toString(),
							notification: {
								title: req.body.transition,
								body: req.body.transition_details,
								sound: 'default'
							}
						};

						fcm.send(message, (err,response) => {
							if(err) {
								res.send('Could not send notification');
							} else {
								res.send('Notification sent');
							}
						});
					} else {
						res.send('Server side error');
					}
				});
			});
		} else {
			res.send('User not found');
		}
	});
});

app.listen(port, () => console.log('Server running at localhost:3000'));
