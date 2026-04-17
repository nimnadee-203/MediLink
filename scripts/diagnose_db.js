import { MongoClient } from 'mongodb';

const url = 'mongodb+srv://MediLink:Medi123@medilink.kfrfcd8.mongodb.net/?retryWrites=true&w=majority&appName=MediLink';

async function checkAtlas() {
    const client = new MongoClient(url);
    try {
        await client.connect();
        console.log('Connected successfully to Atlas');
        
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        
        console.log('\nFound Databases:');
        for (const dbInfo of dbs.databases) {
            console.log(`- ${dbInfo.name}`);
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            if (collections.length > 0) {
                for (const col of collections) {
                    const count = await db.collection(col.name).countDocuments();
                    console.log(`  └─ ${col.name}: ${count} docs`);
                }
            }
        }
    } catch (err) {
        console.error('Connection failed:', err.message);
    } finally {
        await client.close();
    }
}

checkAtlas();
