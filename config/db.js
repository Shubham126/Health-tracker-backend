import mongoose from "mongoose"

export const connectDB = async () => {
    try{
        const uri = process.env.MONGO_URI;

        if(!uri){
            throw new Error("MONGOOSE URI MISSING !!")
        }

        const conn = await mongoose.connect(uri);

        console.log(`Mongo db connected successfully ${conn.connection.host}`);
    }catch(err){
        console.log(`Mongo db connection failed ${err.message}`);
        process.exit(1);
    }
};