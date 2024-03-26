const fs = require('fs');

const docusignService = require('../services/docusign');
const template = require('../templates/sample');

// const signerClientId = 1000;
const dsPingUrl = 'http://localhost:4000';

const makeRecipientViewRequest = async (req, res) => {
	const accountInfo = await docusignService.authenticate();

	try {
		let envelopeArgs = {
			signerEmail: req.body.email,
			signerName: req.body.name,
			signerClientId: req.body.signer_client_id,
			dsReturnUrl: req.body.return_url,
			dsPingUrl: dsPingUrl,
			envelopeId: req.body.envelope_id,
		};

		const args = {
			...accountInfo,
			envelopeArgs,
			dsReturnUrl: req.body.return_url,

		};

		const recipientView = await docusignService.requestSigning(args)

		return res.send(recipientView);
	} catch (error) {
		console.log(error.stack);
		res.send(error.stack);
	}
};

const getEnvelope = async (req, res) => {
	const { envelope_id, event } = req.query;
	const accountInfo = await docusignService.authenticate();
	const args = {
		...accountInfo,
		envelopeId: envelope_id,
	};

	const envelope = await docusignService.getEnvelope(args);

	return res.send({ envelope, event });
};

const createEnvelope = async (req, res) => {
	const accountInfo = await docusignService.authenticate();
	const { envelope_args } = req.body;

	try {
		let envelopeArgs = envelope_args.map(arg => {
			return {
				signerEmail: arg.email,
				signerName: arg.name,
				signerClientId: arg.signer_client_id,
			}
		})

		const args = {
			...accountInfo,
			envelopeArgs,
		};

		envelopeArgs.doc1b64 = Buffer.from(
			template.document1(envelopeArgs[1]),
		).toString('base64');

		const envelope = await docusignService.createEnvelope(args);

		return res.send(envelope);
	} catch (error) {
		console.log(error.stack);
		res.send(error.stack);
	}
}

const listRecipients = async (req, res) => {
	try {
		const accountInfo = await docusignService.authenticate();

		const args = {
			...accountInfo,
			envelopeId: req.query.envelope_id,
		}
		
		const recipients = await docusignService.listRecipients(args);

		return res.status(200).send(recipients);
	}
	catch(e) {
		return res.status(500).send(e.stack);
	}
}

const download = async (req, res) => {
	try {
		const accountInfo = await docusignService.authenticate();

		const args = {
			...accountInfo,
			envelopeId: req.query.envelope_id,
		}

		const doc = await docusignService.getDocument(args);

		const fileName = `./public/${args.envelopeId}.pdf`
		fs.writeFileSync(fileName, doc, { encoding: 'binary' });

		return res.status(200).download(fileName);
	}
	catch(e) {
		console.log('/download :>> ', e.stack);
		return res.status(500).send(e.stack);
	}
}

module.exports = {
	makeRecipientViewRequest,
	getEnvelope,
	createEnvelope,
	listRecipients,
	download,
};
