import express from "express";
import bodyParser from "body-parser";
import env from "dotenv";
import pg from "pg";


const app = express();
const port = 4000;
env.config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    user: process.env.DB_USER,
    host: "localhost",
    database: "AuthData",
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
db.connect();


app.get("/book", async(req, res) => 
{ 
    try
    {
     const result= await db.query("SELECT * FROM book;");
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





app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
});




