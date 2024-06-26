const docusign = require('docusign-esign');
const fs = require('fs');

const SCOPES = ['signature', 'impersonation'];

/**
 * Function to authenticate and get credentials to use docusign api
 * @returns {Promise<object>} Represent account info containing credentials for making request to docusign
 */
const authenticate = async () => {
	const dsOauthServer = process.env.DS_AUTH_SERVER;
	try {
		const jwtLifeSec = 10 * 60; // requested lifetime for the JWT is 10 min

		const dsApi = new docusign.ApiClient();
		dsApi.setOAuthBasePath(dsOauthServer.replace('https://', '')); // it should be domain only.
		let rsaKey = fs.readFileSync('./credentials/docusign/private.key');

		const results = await dsApi.requestJWTUserToken(
			process.env.DS_INTEGRATION_KEY,
			process.env.DS_USER_ID,
			SCOPES,
			rsaKey,
			jwtLifeSec,
		);

		const accessToken = results.body.access_token;

		// get user info
		const userInfoResults = await dsApi.getUserInfo(accessToken);

		// use the default account
		let userInfo = userInfoResults.accounts.find(
			(account) => account.isDefault === 'true',
		);

		return {
			accessToken: results.body.access_token,
			apiAccountId: userInfo.accountId,
			accountId: userInfo.accountId,
			basePath: `${userInfo.baseUri}/restapi`,
		};
	} catch (error) {
		console.log(error.stack);
		let body = error.response && error.response.body;
		// Determine the source of the error
		if (body) {
			// The user needs to grant consent
			if (body.error && body.error === 'consent_required') {
				// Construct consent URL
				const urlScopes = SCOPES.join('+');
				const redirectUri =
					'https://developers.docusign.com/platform/auth/consent';
				const consentUrl =
					`${dsOauthServer}/oauth/auth?response_type=code&` +
					`scope=${urlScopes}&client_id=${process.env.DS_INTEGRATION_KEY}&` +
					`redirect_uri=${redirectUri}`;

				console.log(
					'Open the following URL in your browser to grant consent to the application:',
				);
				console.log(consentUrl);
			}
			process.exit();
		}
	}
};
/**
 * Get envelope details
 * @param {object} args
 * @param {string} args.accountId - credentials obtained from function `authenticate()`
 * @param {string} args.envelopeId - ID of envelope
 * @returns {Promise<object>} Envelope object
 */
const getEnvelope = async (args) => {
	let envelopesApi = newEnvelopesApi(args);

	const results = await envelopesApi.getEnvelope(
		args.accountId,
		args.envelopeId,
		null,
	);

  return results;
};

/**
 * To construct envelope object for payload to call docusign create api
 * @param {Array<object>} args 
 * @param {string} doc1b64 - Base64 string of the document to be use for signing
 * @returns {object} Construct envelope object to be use as request payload
 */
const makeEnvelope = (args, doc1b64) => {
    // Data for this method
    // args.signerEmail
    // args.signerName
    // args.signerClientId
    // docFile
  
    // document 1 (pdf) has tag /sn1/
    //
    // The envelope has one recipients.
    // recipient 1 - signer
  
    // create the envelope definition
    let env = new docusign.EnvelopeDefinition();
    env.emailSubject = 'Please sign this document';
  
    // add the documents
    let doc1 = new docusign.Document();
    doc1.documentBase64 = doc1b64;
    doc1.name = 'Lorem Ipsum'; // can be different from actual file name
    doc1.fileExtension = 'html';
    doc1.documentId = '1';
  
    // The order in the docs array determines the order in the envelope
    env.documents = [doc1];
  
    // Create a signer recipient to sign the document, identified by name and email
    // We set the clientUserId to enable embedded signing for the recipient
    // We're setting the parameters via the object creation
    let signers = [];
    let recipientId = 1;
    for (const arg of args) {
      let signer = docusign.Signer.constructFromObject({
        email: arg.signerEmail,
        name: arg.signerName,
        clientUserId: arg.signerClientId,
        recipientId,
      });

      let signHere = docusign.SignHere.constructFromObject({
        anchorString: `**signature_${recipientId}**`,
        anchorYOffset: '10',
        anchorUnits: 'pixels',
        anchorXOffset: '20',
      });

      let signerTabs = docusign.Tabs.constructFromObject({
        signHereTabs: [signHere],
      });
      signer.tabs = signerTabs;

      signers.push(signer);

      recipientId++;
    }
    env.recipients = docusign.Recipients.constructFromObject({
      signers,
    });
  
    // Request that the envelope be sent by setting |status| to "sent".
    // To request that the envelope be created as a draft, set to "created"
    env.status = 'sent';
  
    return env;
}

/**
 * To create envelope by calling docusign's api
 * @param {object} args
 * @param {Array<object>} args.envelopeArgs envelope arguments containing email, name, signer_client_id
 * @param {string} args.doc1b64 Base64 string of the document to be used
 * @param {string} args.accountId Credential obtained from function `authenticate()`
 * @returns {Promise<object>} Created envelope data
 */
const createEnvelope = async (args) => {
	let envelopesApi = newEnvelopesApi(args);
  let results = null;

  // Step 1. Make the envelope request body
  let envelope = makeEnvelope(args.envelopeArgs, args.doc1b64);

  // Step 2. call Envelopes::create API method
  // Exceptions will be caught by the calling function
  results = await envelopesApi.createEnvelope(args.accountId, {
    envelopeDefinition: envelope,
  });
  
  return results;
}

/**
 * Construct payload request to make recipient view
 * @param {object} args
 * @param {string} args.dsReturnUrl - Return url for browser to redirect when finish viewing/signing document
 * @param {string} args.signerEmail - Signer email who want to sign (needs to be the same when creating envelope)
 * @param {string} args.signerName - Signer name who want to sign (needs to be the same when creating envelope)
 * @param {string} args.signerClientId - Signer client id who want to sign (needs to be the same when creating envelope)
 * @param {string} args.dsPingUrl
 * @returns {object} Constructed request payload
 */
const makeRecipientViewRequest = (args) => {
  // Data for this method
  // args.dsReturnUrl
  // args.signerEmail
  // args.signerName
  // args.signerClientId
  // args.dsPingUrl

  let viewRequest = new docusign.RecipientViewRequest();

  // Set the url where you want the recipient to go once they are done signing
  // should typically be a callback route somewhere in your app.
  // The query parameter is included as an example of how
  // to save/recover state information during the redirect to
  // the DocuSign signing. It's usually better to use
  // the session mechanism of your web framework. Query parameters
  // can be changed/spoofed very easily.
  viewRequest.returnUrl = `${args.dsReturnUrl}?envelope_id=${args.envelopeId}`;

  // How has your app authenticated the user? In addition to your app's
  // authentication, you can include authenticate steps from DocuSign.
  // Eg, SMS authentication
  viewRequest.authenticationMethod = 'none';

  // Recipient information must match embedded recipient info
  // we used to create the envelope.
  // viewRequest.email = args.signerEmail;
  // viewRequest.userName = args.signerName;
  // viewRequest.clientUserId = args.signerClientId;
  viewRequest.email = args.signerEmail;
  viewRequest.userName = args.signerName;
  viewRequest.clientUserId = args.signerClientId;

  // DocuSign recommends that you redirect to DocuSign for the
  // embedded signing. There are multiple ways to save state.
  // To maintain your application's session, use the pingUrl
  // parameter. It causes the DocuSign signing web page
  // (not the DocuSign server) to send pings via AJAX to your
  // app,
  viewRequest.pingFrequency = 600; // seconds
  // NOTE: The pings will only be sent if the pingUrl is an https address
  viewRequest.pingUrl = args.dsPingUrl; // optional setting

  return viewRequest;
}

/**
 * To request url for signer to view and sign document
 * @param {object} args 
 * @param {object} args.envelopeArgs
 * @param {string} args.envelopeArgs.envelopeId - Which envelope to view and sign
 * @param {string} args.envelopeArgs.dsReturnUrl - Return url for browser to redirect when finish viewing/signing document
 * @param {string} args.envelopeArgs.signerEmail - Signer email who want to sign (needs to be the same when creating envelope)
 * @param {string} args.envelopeArgs.signerName - Signer name who want to sign (needs to be the same when creating envelope)
 * @param {string} args.envelopeArgs.signerClientId - Signer client id who want to sign (needs to be the same when creating envelope)
 * @param {string} args.envelopeArgs.dsPingUrl
 * @returns {Promise<object>} Object containing field url for visiting docusign document viewer and sign
 */
const requestSigning = async (args) => {
	let envelopesApi = newEnvelopesApi(args);

  let viewRequest = makeRecipientViewRequest(args.envelopeArgs);
  // Call the CreateRecipientView API
  // Exceptions will be caught by the calling function
  const recipientView = await envelopesApi.createRecipientView(args.accountId, args.envelopeArgs.envelopeId, {
    recipientViewRequest: viewRequest,
  });

  return recipientView;
}

/**
 * To get list recipients of envelope
 * @param {object} args 
 * @param {string} args.accountId - Credential obtained from function `authenticate()`
 * @param {string} args.envelopeId - Which envelope to get
 * @returns {Promise<object>} Response from docusign api containing recipients of envelope
 */
const listRecipients = async (args) => {
	let envelopesApi = newEnvelopesApi(args);

  const recipients = await envelopesApi.listRecipients(
    args.accountId,
    args.envelopeId,
    null
  );

  return recipients;
}

/**
 * To get the document file of envlope
 * @param {object} args 
 * @param {string} args.accountId - Credential obtained from function `authenticate()`
 * @param {string} args.envelopeId - Which envelope to get
 * @returns {Promise<Buffer>} Buffer of the document
 */
const getDocument = async (args) => {
	let envelopesApi = newEnvelopesApi(args);

  const docs = await envelopesApi.getDocument(
    args.accountId,
    args.envelopeId,
    'combined',
    null,
  );

  return docs;
};

/**
 * To instantiate envelopes api
 * @param {object} args 
 * @param {object} args.basePath - The api base path obtained from function `authenticate()`
 * @param {object} args.accessToken - JWT token obtained from function `authenticate()`
 * @returns {docusign.EnvelopesApi} New instance of envelopes api object
 */
const newEnvelopesApi = (args) => {
  let dsApiClient = new docusign.ApiClient();
	dsApiClient.setBasePath(args.basePath);
	dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
	return new docusign.EnvelopesApi(dsApiClient);
}

module.exports = {
	authenticate,
	createEnvelope,
  getEnvelope,
  makeRecipientViewRequest,
  requestSigning,
  listRecipients,
  getDocument,
};
