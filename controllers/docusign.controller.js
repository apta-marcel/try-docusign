const docusignService = require('../services/docusign');
const template = require('../templates/sample');

const signerClientId = 1000;
const dsPingUrl = 'http://localhost:4000';

const makeSenderViewRequest = async (req, res) => {
	const accountInfo = await docusignService.authenticate();

	try {

		const envelopeArgs = {
			signerEmail: req.body.email,
			signerName: req.body.name,
			status: 'sent',
			signerClientId: signerClientId,
			dsReturnUrl: req.body.return_url,
			dsPingUrl: dsPingUrl,
		};

		const args = {
			...accountInfo,
			envelopeArgs,
			dsReturnUrl: req.body.return_url,
		};

		
		const doc1Base64 = Buffer.from(template.document1(envelopeArgs)).toString(
			'base64',
		);

		const senderView = await docusignService.createEnvelope(args, doc1Base64);

		return res.send(senderView);

		// const envelope = await docusignService.getEnvelope({ ...args, envelopeId: senderView });

		// return res.send(envelope);
	} catch (error) {
		console.log(error.stack);
		res.send(error.stack);
	}
};

const makeRecipientViewRequest = async (req, res) => {
	const accountInfo = await docusignService.authenticate();

	try {
		let envelopeArgs = {
			signerEmail: req.body.email,
			signerName: req.body.name,
			status: 'sent',
			signerClientId: signerClientId,
			dsReturnUrl: req.body.return_url,
			dsPingUrl: dsPingUrl,
		};

		const args = {
			...accountInfo,
			envelopeArgs,
			dsReturnUrl: req.body.return_url,
		};

		envelopeArgs.doc1b64 = Buffer.from(template.document1(envelopeArgs)).toString(
			'base64',
		);

		const recipientView = await docusignService.createEnvelope(args);

		return res.send(recipientView);
	} 
	catch (error) {
		console.log(error.stack);
		res.send(error.stack);
	}
}

module.exports = {
	makeSenderViewRequest,
	makeRecipientViewRequest,
};
