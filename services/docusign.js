const docusign = require('docusign-esign');
const fs = require('fs');

const SCOPES = ['signature', 'impersonation'];

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

const getEnvelope = async (args) => {
	let dsApiClient = new docusign.ApiClient();
	dsApiClient.setBasePath(args.basePath);
	dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
	let envelopesApi = new docusign.EnvelopesApi(dsApiClient);

	const results = await envelopesApi.getEnvelope(
		args.accountId,
		args.envelopeId,
		null,
	);

  const docs = await envelopesApi.getDocument(
    args.accountId,
    args.envelopeId,
    'combined',
    null,
  );

  fs.writeFileSync(`./public/${args.envelopeId}.pdf`, docs, { encoding: 'binary' });

  return results;
};

const makeEnvelope = (args) => {
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
    doc1.documentBase64 = args.doc1b64;
    doc1.name = 'Lorem Ipsum'; // can be different from actual file name
    doc1.fileExtension = 'html';
    doc1.documentId = '1';
  
    // The order in the docs array determines the order in the envelope
    env.documents = [doc1];
  
    // Create a signer recipient to sign the document, identified by name and email
    // We set the clientUserId to enable embedded signing for the recipient
    // We're setting the parameters via the object creation
    let signer1 = docusign.Signer.constructFromObject({
      email: 'krabs@yopmail.com',
      name: 'Eugene Krabs',
      clientUserId: args.signerClientId,
      recipientId: 1,
    });
    let signer2 = docusign.Signer.constructFromObject({
      email: args.signerEmail,
      name: args.signerName,
      clientUserId: args.signerClientId + 1000,
      recipientId: 2,
    });
  
    // Create signHere fields (also known as tabs) on the documents,
    // We're using anchor (autoPlace) positioning
    //
    // The DocuSign platform seaches throughout your envelope's
    // documents for matching anchor strings.
    let signHere1 = docusign.SignHere.constructFromObject({
      anchorString: '**signature_1**',
      anchorYOffset: '10',
      anchorUnits: 'pixels',
      anchorXOffset: '20',
    });
    let signHere2 = docusign.SignHere.constructFromObject({
      anchorString: '**signature_2**',
      anchorYOffset: '10',
      anchorUnits: 'pixels',
      anchorXOffset: '20',
    });

    // Tabs are set per recipient / signer
    let signer1Tabs = docusign.Tabs.constructFromObject({
      signHereTabs: [signHere1],
    });
    signer1.tabs = signer1Tabs;

    let signer2Tabs = docusign.Tabs.constructFromObject({
      signHereTabs: [signHere2],
    });
    signer2.tabs = signer2Tabs;
  
    // Add the recipient to the envelope object
    let recipients = docusign.Recipients.constructFromObject({
      signers: [signer1, signer2],
    });
    env.recipients = recipients;
  
    // Request that the envelope be sent by setting |status| to "sent".
    // To request that the envelope be created as a draft, set to "created"
    env.status = 'created';
  
    return env;
}

const createEnvelope = async (args) => {
  let dsApiClient = new docusign.ApiClient();
  dsApiClient.setBasePath(args.basePath);
  dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
  let envelopesApi = new docusign.EnvelopesApi(dsApiClient);
  let results = null;

  // Step 1. Make the envelope request body
  let envelope = makeEnvelope(args.envelopeArgs);

  // Step 2. call Envelopes::create API method
  // Exceptions will be caught by the calling function
  results = await envelopesApi.createEnvelope(args.accountId, {
    envelopeDefinition: envelope,
  });
  
  return results;
}

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

const requestSigning = async (args) => {
  let dsApiClient = new docusign.ApiClient();
  dsApiClient.setBasePath(args.basePath);
  dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
  let envelopesApi = new docusign.EnvelopesApi(dsApiClient);

  let viewRequest = makeRecipientViewRequest(args.envelopeArgs);
  // Call the CreateRecipientView API
  // Exceptions will be caught by the calling function
  const recipientView = await envelopesApi.createRecipientView(args.accountId, args.envelopeArgs.envelopeId, {
    recipientViewRequest: viewRequest,
  });

  return recipientView;
}

module.exports = {
	authenticate,
	createEnvelope,
  getEnvelope,
  makeRecipientViewRequest,
  requestSigning,
};
