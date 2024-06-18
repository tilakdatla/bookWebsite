import express from "express";
import bodyParser from "body-parser";
import env from "dotenv";
import pg from "pg";


const app = express();
const port = 5000;
env.config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const connectString=`postgres//${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.HostName}:${process.env.DB_PORT}/${process.env.DB_NAME}`;


const db = new pg.Client({
    connectionString:connectString,
    user: process.env.DB_USER,
    host: "localhost",
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
db.connect();


//search book by title or author
app.get("/search/:item", async (req, res) => {
    const searchItem = req.params.item; // Use req.params.item instead of req.query.item
    try {
      const result = await db.query(
        "SELECT * FROM bookData WHERE title ILIKE '%' || $1 || '%' OR author ILIKE '%' || $1 || '%'",
        [searchItem]
      );
      if (result.rows.length > 0) {
        res.json(result.rows);
      } else {
        res.json({ err: "No Book found" });
      }
    } catch (err) {
      res.json({ error: "Something went wrong" });
    }
  });
  






app.post("/remove/:id",async(req,res)=>{
  
    const bookId=req.params.id;
    try{
        const result=await db.query("delete from bookData where id=$1;",[bookId]);
        if(result.rows.length>0)
        {
            res.json({ success: true });
        }
        else
        {
            res.json({err:"Book does not exist"});
        }
    }
    catch(err)
    {
        console.log(err);
    }

});


app.get("/book", async(req, res) => 
{ 
    try
    {
        const result= await db.query("SELECT * FROM bookData;");
        if(result.rows.length>0)
        {
          res.send(result.rows);
        }
    }
    catch(err)
    {
        res.json({error:"somthing went wrong"});
    }
});

app.post("/new", async(req, res) => 
{ 
    try
    {
        await db.query(
            "INSERT INTO bookData (title, summary, author, rating, type, description, user_id, date,book_img_location) VALUES ($1, $2, $3, $4, $5, $6, $7,$8,$9)",
            [req.body.title,req.body.summary,req.body.author,req.body.rating,req.body.type,req.body.description,req.body.user_id,req.body.date,req.body.book_img_location]
          );
          res.json({ success: true });
    }
    catch(err)
    {
        res.json({error:"somthing went wrong"});
    }
});

app.get("/book/:id", async(req, res) => 
{ 
    try
    {
        const id=req.params.id;
        const book=[];
        const result= await db.query("SELECT * FROM bookData WHERE user_id=$1",[id]);
        if(result.rows.length>0)
        {
            res.send(result.rows);
        }
        else
        {
            res.send(book);
        }
    }
    catch(err)
    {
        res.json({error:"somthing went wrong"});
    }
});


app.post("/book/:id", async(req, res) => 
{ 
    try
    {
        const id=req.params.id;
        const result= await db.query("UPDATE bookData SET book_img_location = $1,title = $2,author = $3,summary = $4,description = $5,rating = $6,type = $7 WHERE id = $8;",[req.body.book_img_location,req.body.title,req.body.author,req.body.summary,req.body.description,req.body.rating,req.body.type,id]);
        if(result.rows.length>0)
        {
            res.send(result.rows);
        }
        else
        {
            res.send({err:"Something went wrong"});
        }
    }
    catch(err)
    {
        res.json({error:"somthing went wrong"});
    }
});


app.get("/books/:id", async(req, res) => 
{ 
    try
    {
        const id=req.params.id;
        const result= await db.query("SELECT * FROM bookData WHERE id=$1",[id]);
        
        if(result.rows.length>0)
        {
            res.send(result.rows[0]);
        }
    }
    catch(err)
    {
        res.json({error:"somthing went wrong"});
    }
});


app.get("/location/:id", async (req, res) => {
    try {
        const id = req.params.id;

        // Get the district for the given user ID
        const result = await db.query("SELECT DISTINCT district FROM interests WHERE user_id = $1", [id]);
        if (result.rows.length > 0) {
            const district = result.rows[0].district;
            const searchPattern = '%' + district + '%';
            // Get the user details in the same district, excluding the given user ID
            const result2 = await db.query(`
            SELECT DISTINCT u.id, u.nickname, u.email, i.district, i.phone as location
            FROM interests i
            JOIN users u ON i.user_id = u.id
            WHERE i.district LIKE $1 AND i.user_id != $2
            LIMIT 5;
            `, [searchPattern, id]);

            if (result2.rows.length > 0) {
                res.send(result2.rows);
            } else {
                res.send({ err: "No other users found in the same district." });
            }
        } else {
            res.send({ err: "District not found for the given user ID." });
        }
    } catch (err) {
        res.send({ err: "An error occurred: " + err.message });
    }
});


app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
});
