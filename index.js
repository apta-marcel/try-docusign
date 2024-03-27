require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const docusignService = require('./services/docusign');
const docusignController = require('./controllers/docusign.controller');
const morgan = require('morgan');

const main = async () => {
	docusignService.authenticate();

	const app = express();

	app.use(bodyParser.json());
	app.use(morgan('dev'));

	app.get('/', docusignController.getEnvelope);
	app.post('/create', docusignController.createEnvelope);
	app.post('/sign', docusignController.makeRecipientViewRequest);
	app.get('/recipients', docusignController.listRecipients);
	app.get('/download', docusignController.download);

	app.listen(process.env.PORT, () =>
		console.log(`Listening on port ${process.env.PORT}`),
	);
};

main();
