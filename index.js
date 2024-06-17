import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
const { authorize } = passport;
import { Strategy as LocalStrategy } from "passport-local";
import env from "dotenv";
import { Strategy as GoogleStrategy } from "passport-google-oauth2";
import axios from "axios";
import multer from "multer";

const app = express();
const port = 3000;

env.config();
const saltRounds = 10;

app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 2
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');

const db = new pg.Client({
  user: process.env.DB_USER,
  host: "localhost",
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();


app.get('/search',async(req,res)=>{
 
  const searchQuery = req.query.query;
  try{
    const response = await axios.get(`http://localhost:5000/search/${searchQuery}`);
    if(response.data) 
     res.render('search-item', { books: response.data });
  }
  catch(err)
  {
    console.log(err);
    res.status(500).send("Error saving the book");
  }  


});



app.get('/chat', async (req, res) => {
  const userNickname = req.query.user;
  const otherUserNickname = req.query.otherUser;
  const currentUser = req.user || {}; // Get the current user from the session or authentication middleware

  // Generate a unique room ID based on the two nicknames
  const roomId = generateRoomId(userNickname, otherUserNickname);

  res.render('real-chat.ejs', { user: userNickname, room: roomId, currentUser });
});

// Helper function to generate a unique room ID
function generateRoomId(user1, user2) {
  const [sortedUser1, sortedUser2] = [user1, user2].sort();
  return `${sortedUser1}-${sortedUser2}`;
}

// Render the user profile page
app.get('/profile/:id', async (req, res) => {
  const id = req.params.id;
  const currentUser = req.user || {}; // Assuming you have access to the current user object from the session or authentication middleware

  try {
    // Fetch book data
    const response = await axios.get(`http://localhost:5000/book/${id}`);
    const bookData = response.data || [];

    // Fetch user data
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    const user = userResult.rows[0];

    // Fetch interests data
    const interestsResult = await db.query("SELECT * FROM interests WHERE user_id = $1", [id]);
    const interestsData = interestsResult.rows[0];

    // Render the profile page with the user, book data, and current user data
    res.render('user-profile.ejs', { user, books: bookData, interestsData, currentUser });
  } catch (err) {
    console.log(err);
    res.redirect("/secrets");
  }
});

const storage=multer.diskStorage(
{
    destination: function (req, file, cb){
        return cb(null,'./uploads');
    },
    filename: function(req,file,cb){
        return cb(null,`${Date.now()}-${file.originalname}`);
    },
}
);

const upload=multer({storage});

app.get('/upload', (req, res) => {

  if (req.isAuthenticated())
  {
    res.render("upload.ejs");     
  }
  else
  {
    res.redirect("/login");
  }
})


function formatDate(date) {
  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}




app.post('/upload',upload.single('bookImage'), async(req, res) => 
{

  if (req.isAuthenticated())
  {
    
    const date = new Date();
    const formattedDate = formatDate(date);
    
    const data={
      title:req.body.title,
      summary:req.body.summary,
      author:req.body.author,
      rating:req.body.rating,
      type:req.body.type,
      description:req.body.description,
      user_id:req.user.id,
      date:formattedDate,
      book_img_location: req.file.path.replace(/\\/g, '/'),
    };

    try{
     const response = await axios.post(`http://localhost:5000/new`, data);
     if(response.data.success)
     {
      res.redirect("/secrets");
     }
     else
     {
       res.redirect("/upload")
     }
    }
    catch(err)
    {
      console.log(err);
      res.status(500).send("Error saving the book");
    }  
  }
  else{
    res.redirect("/login");
  }
  
})


app.get('/listing', async(req, res) => {

  const id=req.user.id;
  const response = await axios.get(`http://localhost:5000/book/${id}`);
  
  if(response.data)
  {
   res.render("listing.ejs",{books:response.data});
  }
  else
  {
    res.redirect("/secrets");
  }

});




app.get('/updatebook/:id',async(req,res)=>{
  
  const bookId=req.params.id;

  try{
    const response = await axios.get(`http://localhost:5000/books/${bookId}`);

    if(response.data)
    {
       res.render("update-book.ejs",{book:response.data});
    }
    else{
      res.redirect("/secrets");
    }
  }
  catch(err)
  {
    console.log(err);
  }

});


app.post('/updatebook/:id',upload.single('bookImage'),async(req,res)=>{
  
  const id=req.params.id;

  try{
    
    const Response = await axios.get(`http://localhost:5000/books/${id}`);

    const data={
      title:req.body.title,
      author:req.body.author,
      summary:req.body.summary,
      description:req.body.description,
      rating:req.body.rating,
      type:req.body.type,
      book_img_location:req.file ? req.file.path.replace(/\\/g, '/') : Response.data.book_img_location
    };
   
   
    const response = await axios.post(`http://localhost:5000/book/${id}`,data);
    if(response.data)
    {
      res.redirect('/listing');
    }
    else
    {
       res.redirect('/secrets');
    }

  }
  catch(err)
  {
    console.log(err);
  }
});


app.post('/removebook/:id',async(req,res)=>{
   
  const bookId=req.params.id;
  try {
    const response = await axios.post(`http://localhost:5000/remove/${bookId}`);
    if (response.data.success) {
        res.redirect('/listing');
    } else {
        res.redirect('/secrets');
    }
    } catch (error) {
        console.error('Error removing book:', error);
        res.redirect('/secrets');
    }

});


app.get('/active-user', async (req, res) => { // Corrected parameter order
  try {
      const id = req.user.id;
      const response = await axios.get(`http://localhost:5000/location/${id}`);
      
      if (response.data) {
          res.render("active-user.ejs", { users: response.data });
      } else {
          res.redirect("/secrets");
      }
  } catch (err) {
      res.status(500).send({ err: "An error occurred: " + err.message });
  }
});







app.get('/bookdata/:id',async(req,res)=>{
    
  try{
    const id=req.params.id;
    const Response = await axios.get(`http://localhost:5000/books/${id}`);
   
    if(Response.data)
    {
     const bookData = Response.data;
    
     res.render("bookdata.ejs", { book: bookData });
    }
  }
  catch(err)
  {
    console.log(err);
  }
});














app.get('/forgot-password', (req, res) => {
  res.render("reset-password.ejs");
});

app.post('/reset-password', async (req, res) => {
  const { email, new_password, confirm_password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    if (result.rows.length > 0) {
      if (new_password === confirm_password) {
        bcrypt.hash(new_password, saltRounds, async (err, hash) => {
          if (err) {
            console.log(err);
          } else {
            try {
              await db.query("UPDATE users SET password = $1 WHERE email = $2", [hash, email]);
              res.render("login.ejs", { error: "Password updated successfully" });
            } catch (err) {
              console.log(err);
              res.render("reset-password.ejs", { error: "Something went wrong, try again" });
            }
          }
        });
      } else {
        res.render("reset-password.ejs", { error: "Passwords do not match" });
      }
    } else {
      res.render("reset-password.ejs", { error: "User not found, please register first" });
    }
  } catch (err) {
    res.send(err);
  }
});

app.get("/additional-info", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("additional-info.ejs");
  } else {
    res.redirect("/login");
  }
});

app.post("/additional-info", async (req, res) => {
  if (req.isAuthenticated()) {
    const { interest, phone, state, district, town, pincode } = req.body;

    try {
      const checkPhoneResult = await db.query("SELECT * FROM interests WHERE phone = $1", [phone]);

      if (checkPhoneResult.rows.length > 0) {
        // If phone number already exists, render additional-info page with error message
        res.render("additional-info.ejs", { error: "Phone number already exists. Please use a different phone number." });
      } else {
        // Convert interest to an array if it is not already
        const interests = Array.isArray(interest) ? interest : [interest];

        for (const interestName of interests) {
          // Insert into the interests table
          await db.query(
            "INSERT INTO interests (user_id, interest, phone, state, district, town, pincode) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [req.user.id, interestName, phone, state, district, town, pincode]
          );
        }

        res.redirect("/secrets");
      }
    } catch (err) {
      console.log(err);
      res.render("additional-info.ejs", { error: "An error occurred while adding interests. Please try again." });
    }
  } else {
    res.redirect("/login");
  }
});


app.get("/secrets", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const result = await db.query("SELECT * FROM interests WHERE user_id = $1", [req.user.id]);
      if (result.rows.length === 0) {
        res.redirect("/additional-info");
      } else {
        try {
          const response = await axios.get(`http://localhost:5000/book`);
          
          res.render("next.ejs", { books: response.data });
        } catch (error) {
          res.status(500).json({ message: "Error fetching posts" });
        }
      }
    } catch (err) {
      console.log(err);
      res.redirect("/additional-info");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/sample-book/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const response = await axios.get(`http://localhost:4000/book`);
    res.render("sample.ejs", { book: response.data[id - 1] });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    if (req.user.isNewUser) {
      res.redirect("/additional-info");
    } else {
      res.redirect("/secrets");
    }
  }
);

app.get("/", async (req, res) => {
  try {
    const response = await axios.get(`http://localhost:4000/book`);
    res.render("index.ejs", { book: response.data });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const { email, password, fname, lname, nickname } = req.body;

  try {
    const checkEmailResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const checkNicknameResult = await db.query("SELECT * FROM users WHERE nickname = $1", [nickname]);

    if (checkEmailResult.rows.length > 0) {
      res.render("register.ejs", { error: "Email already exists. Try to log in." });
    } else if (checkNicknameResult.rows.length > 0) {
      res.render("register.ejs", { error: "Nickname already exists. Choose a different nickname." });
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password, fname, lname, nickname) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [email, hash, fname, lname, nickname]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/secrets");
            }
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/login", async (req, res, next) => {
  passport.authenticate("local", function (err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.render("login.ejs", { error: info.message });
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }
      return res.redirect("/secrets");
    });
  })(req, res, next);
});

passport.use("local", new LocalStrategy(async function verify(username, password, cb) {
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedHashedPassword = user.password;
      bcrypt.compare(password, storedHashedPassword, (err, isMatch) => {
        if (err) {
          return cb(err);
        } else {
          if (isMatch) {
            return cb(null, user);
          } else {
            return cb(null, false, { message: "Incorrect password" });
          }
        }
      });
    } else {
      return cb(null, false, { message: "User not found, please register first" });
    }
  } catch (err) {
    return cb(err);
  }
}));

passport.use("google", new GoogleStrategy({
  clientID: process.env.ClientId,
  clientSecret: process.env.ClientSecret,
  callbackURL: 'http://localhost:3000/auth/google/secrets',
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
}, async (accessToken, refreshToken, profile, cb) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE email=$1", [profile.email]);
    if (result.rows.length == 0) {
      const fname = profile.given_name || "";
      const lname = profile.family_name || "";
      const nickname = profile.displayName || profile.given_name || "";

      const newUser = await db.query(
        "INSERT INTO users (email, password, fname, lname, nickname) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [profile.email, "google", fname, lname, nickname]
      );
      newUser.rows[0].isNewUser = true;  // Set a flag to identify new users
      cb(null, newUser.rows[0]);
    } else {
      cb(null, result.rows[0]);
    }
  } catch (error) {
    cb(error);
  }
}));


app.get("/profile", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const userResult = await db.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
      const interestsResult = await db.query("SELECT * FROM interests WHERE user_id = $1", [req.user.id]);
      const user = userResult.rows[0];
      const interestsData = interestsResult.rows[0];
      const interests = interestsResult.rows.map(row => row.interest);

      res.render("profile.ejs", { user, interests, interestsData });
    } catch (err) {
      console.log(err);
      res.redirect("/secrets");
    }
  } 
  else {
    res.redirect("/login");
  }
});


app.post("/profile", async (req, res) => {
  if (req.isAuthenticated()) {
    const {
      fname = '',
      lname = '',
      nickname = '',
      interests= [],
      phone = '',
      state = '',
      district = '',
      town = '',
      pincode = ''
    } = req.body;

    try {
      const userResult = await db.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
      const interestsResult = await db.query("SELECT * FROM interests WHERE user_id = $1", [req.user.id]);
      const user = userResult.rows[0];
      const interestsData = interestsResult.rows[0];
      const oldinterest=await db.query("select interest from interests where user_id=$1",[req.user.id]); 
      const oldinterestData=oldinterest.rows;
      const interestsarray=req.body.interests;
     

      const fnameValue = fname || user.fname;
      const lnameValue = lname || user.lname;
      const nicknameValue = nickname || user.nickname;
      const phoneValue = phone || interestsData.phone;
      const stateValue = state || interestsData.state;
      const districtValue = district || interestsData.district;
      const townValue = town || interestsData.town;
      const pincodeValue = pincode || interestsData.pincode;

      await db.query(
        "UPDATE users SET fname = $1, lname = $2, nickname = $3 WHERE id = $4",
        [fnameValue, lnameValue, nicknameValue, req.user.id]
      );

     
      
      for(let i=0;i<oldinterestData.length;i++)
      {
       await db.query(
        "delete from interests where user_id=$1 AND interest =$2",
        [req.user.id,oldinterestData[i].interest]
       );
      }
      
      for(let i=0;i<interestsarray.length;i++)
      {
        await db.query(
          "INSERT INTO interests (user_id, interest, phone, state, district, town, pincode) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [req.user.id,interestsarray[i],phoneValue, stateValue, districtValue, townValue, pincodeValue]
        );
      }

      res.redirect("/profile");
    } catch (err) {
      console.log(err);
      res.redirect("/profile");
    }
  } else {
    res.redirect("/login");
  }
});



passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
