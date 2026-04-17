import mongoose from "mongoose";

const url = 'mongodb+srv://MediLink:Medi123@medilink.kfrfcd8.mongodb.net/appointments?retryWrites=true&w=majority&appName=MediLink';

const testSchema = new mongoose.Schema({ name: String });
const TestModel = mongoose.model("TestConnection", testSchema);

async function runTest() {
    console.log('Attempting to connect to Atlas...');
    try {
        await mongoose.connect(url);
        console.log('✅ Connected to MongoDB Atlas successfully.');
        
        console.log('Attempting to WRITE a test document...');
        const doc = await TestModel.create({ name: 'Connection Test' });
        console.log('✅ Successfully wrote to "appointments" database.');
        console.log('Document ID:', doc._id);

        const dbs = await mongoose.connection.db.admin().listDatabases();
        console.log('\nVerified Databases on Cluster:');
        dbs.databases.forEach(db => console.log(`- ${db.name}`));

    } catch (err) {
        console.log('\n❌ CONNECTION FAILED!');
        console.log('Error Name:', err.name);
        console.log('Error Message:', err.message);
        if (err.message.includes('whitelsit') || err.message.includes('IP')) {
            console.log('\nADVICE: Your current IP address is likely not whitelisted in the MongoDB Atlas networking tab.');
        }
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
