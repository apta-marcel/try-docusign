require('dotenv').config();
const docusignService = require('../../../services/docusign');
const template = require('../../../templates/sample');

const testDataEnvelopeId = '712e6e9d-89c1-49c9-ac5d-7ec6f24861aa';
const SECONDS = 1000;
const createEnvelopeTestRequestBody = [
	{
		email: 'test-app@yopmail.com',
		name: 'App Admin',
		signer_client_id: '1000',
	},
	{
		email: 'mermaid.man@yopmail.com',
		name: 'Mermaid Man',
		signer_client_id: '2000',
	},
];
const makeRecipientViewTestRequestBody = {
	email: 'mermaid.man@yopmail.com',
	name: 'Mermaid Man',
	return_url: 'http://localhost:4000/recipients',
	envelope_id: '712e6e9d-89c1-49c9-ac5d-7ec6f24861aa',
	signer_client_id: '2000',
};
const dsPingUrl = 'http://localhost:4000';

jest.setTimeout(999 * SECONDS);

describe('getEnvelope', () => {
	it('should return result containing at least status and envelopeId fields', async () => {
		const accountInfo = await docusignService.authenticate();
		const args = {
			...accountInfo,
			envelopeId: testDataEnvelopeId,
		};
		const envelope = await docusignService.getEnvelope(args);

		expect(envelope).toHaveProperty('status');
		expect(envelope).toHaveProperty('envelopeId');
	});
});

describe('createEnvelope', () => {
	it('should return created envelope id', async () => {
		const accountInfo = await docusignService.authenticate();

		let envelopeArgs = createEnvelopeTestRequestBody.map((arg) => {
			return {
				signerEmail: arg.email,
				signerName: arg.name,
				signerClientId: arg.signer_client_id,
			};
		});

		const args = {
			...accountInfo,
			envelopeArgs,
		};

		args.doc1b64 = Buffer.from(template.document1(envelopeArgs[1])).toString(
			'base64',
		);

		const envelope = await docusignService.createEnvelope(args);

		expect(envelope).toHaveProperty('envelopeId');
		expect(envelope).toHaveProperty('status');
	});
});

describe('listRecipients', () => {
	it('should retrieve list of recipients with status', async () => {
		const accountInfo = await docusignService.authenticate();

		const args = {
			...accountInfo,
			envelopeId: testDataEnvelopeId,
		};

		const { signers } = await docusignService.listRecipients(args);

		for (const signer of signers) {
			expect(signer).toHaveProperty('clientUserId');
			expect(signer).toHaveProperty('email');
			expect(signer).toHaveProperty('name');
			expect(signer).toHaveProperty('recipientId');
			expect(signer).toHaveProperty('status');
		}
	});
});

describe('getDocument', () => {
	it('should return the Buffer string for the document', async () => {
		const accountInfo = await docusignService.authenticate();

		const args = {
			...accountInfo,
			envelopeId: testDataEnvelopeId,
		};

		const doc = await docusignService.getDocument(args);

		expect(typeof doc).toBe('string');
	});
});

describe('requestSigning', () => {
	it('should return object with url field', async () => {
		const accountInfo = await docusignService.authenticate();
		let envelopeArgs = {
			signerEmail: makeRecipientViewTestRequestBody.email,
			signerName: makeRecipientViewTestRequestBody.name,
			signerClientId: makeRecipientViewTestRequestBody.signer_client_id,
			dsReturnUrl: makeRecipientViewTestRequestBody.return_url,
			dsPingUrl: dsPingUrl,
			envelopeId: makeRecipientViewTestRequestBody.envelope_id,
		};

		const args = {
			...accountInfo,
			envelopeArgs,
			dsReturnUrl: makeRecipientViewTestRequestBody.return_url,
		};

		const recipientView = await docusignService.requestSigning(args);

		expect(recipientView).toHaveProperty('url');
	});
});

describe('authenticate', () => {
	it('should return account credentials including', async () => {
		const accountInfo = await docusignService.authenticate();

		expect(accountInfo).toHaveProperty('accountId');
		expect(accountInfo).toHaveProperty('basePath');
		expect(accountInfo).toHaveProperty('accessToken');
	});
});
