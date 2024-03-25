require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');

const docusignService = require('./services/docusign');
const docusignController = require('./controllers/docusign.controller');

const main = async () => {
    docusignService.authenticate();

    const app = express();

    app.use(bodyParser.json());

    app.get('/', (req, res) => res.send('Hello world'));
    app.post('/sign', docusignController.makeRecipientViewRequest);

    app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));
}


main();