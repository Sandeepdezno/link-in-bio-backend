const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: './database.sqlite',
    },
    useNullAsDefault: true
});

async function setupDatabase() {
    console.log('Setting up Database');
    try {

        await knex.schema.createTable('users', table => {
            table.increments('id');
            table.string('name');
            table.string('email').unique();
            table.string('password');
            table.string('bio');
            table.string('profilePictureUrl');
        });
        console.log('Table: users Created');

        await knex.schema.createTable('links', table => {
            table.string('title');
            table.string('url');
            table.integer('userId').unsigned().references('id').inTable('users');
        });
        console.log('Table: links created');
    }
    catch (error) {
        console.error('Creating Tables failed: ', error);
    }
    finally {
        await knex.destroy();
        console.log('Database Created');
    }
}

setupDatabase();