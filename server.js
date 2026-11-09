import express from "express";
import "dotenv/config";

const app = express();

let port = process.env.PORT || 3001

app.use(express.json());

app.get('/health', (req, res)=>{
    res.status(200).send("This app is running good");
})

app.listen(port, () =>{
    console.log(`this app is running on port ${port}`);
})