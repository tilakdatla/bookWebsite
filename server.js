import express from "express";
import bodyParser from "body-parser";
import env from "dotenv";
import pg from "pg";


const app = express();
const port = 4000;
env.config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const connectString=`postgres//${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.HostName}:${process.env.DB_PORT}/AuthData`;

const db = new pg.Client({
    connectionString: connectString
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




