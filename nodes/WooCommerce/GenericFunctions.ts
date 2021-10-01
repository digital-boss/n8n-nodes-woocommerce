import {
	OptionsWithUri,
} from 'request';

import {
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-core';

import {
	ICredentialDataDecryptedObject,
	IDataObject,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

import {
	ICouponLine,
	IFeeLine,
	ILineItem,
	IShoppingLine,
} from './OrderInterface';

import {
	createHash,
} from 'crypto';

import {
	snakeCase,
} from 'change-case';

import {
	omit
} from 'lodash';

export async function woocommerceApiRequest(this: IHookFunctions | IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions | IWebhookFunctions, method: string, resource: string, body: any = {}, qs: IDataObject = {}, uri?: string, option: IDataObject = {}, path?: string): Promise<any> { // tslint:disable-line:no-any
	const credentials = await this.getCredentials('wooCommerceApi');
	if (credentials === undefined) {
		throw new NodeOperationError(this.getNode(), 'No credentials got returned!');
	}
	if(path) {
		path = `${credentials.url}${path}`;
	}

	let options: OptionsWithUri = {
		auth: {
			user: credentials.consumerKey as string,
			password: credentials.consumerSecret as string,
		},
		method,
		qs,
		body,
		uri: uri || path || `${credentials.url}/wp-json/wc/v3${resource}`,
		json: true,
	};

	if (credentials.includeCredentialsInQuery === true) {
		delete options.auth;
		Object.assign(qs, { consumer_key: credentials.consumerKey, consumer_secret: credentials.consumerSecret });
	}

	if (!Object.keys(body).length) {
		delete options.form;
	}

	options = Object.assign({}, options, option);
	try {
		return await this.helpers.request!(options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error);
	}
}

export async function woocommerceApiRequestAllItems(this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions, method: string, endpoint: string, body: any = {}, query: IDataObject = {}): Promise<any> { // tslint:disable-line:no-any

	const returnData: IDataObject[] = [];

	let responseData;
	let uri: string | undefined;
	query.per_page = 100;
	do {
		responseData = await woocommerceApiRequest.call(this, method, endpoint, body, query, uri, { resolveWithFullResponse: true });
		uri = responseData.headers['link'].split(';')[0].replace('<', '').replace('>', '');
		returnData.push.apply(returnData, responseData.body);
	} while (
		responseData.headers['link'] !== undefined &&
		responseData.headers['link'].includes('rel="next"')
	);

	return returnData;
}

/**
 * Creates a secret from the credentials
 *
 * @export
 * @param {ICredentialDataDecryptedObject} credentials
 * @returns
 */
export function getAutomaticSecret(credentials: ICredentialDataDecryptedObject) {
	const data = `${credentials.consumerKey},${credentials.consumerSecret}`;
	return createHash('md5').update(data).digest('hex');
}

export function setMetadata(data:
	IShoppingLine[] |
	IShoppingLine[] |
	IFeeLine[] |
	ILineItem[] |
	ICouponLine[]) {
	for (let i = 0; i < data.length; i++) {
		//@ts-ignore\
		if (data[i].metadataUi && data[i].metadataUi.metadataValues) {
			//@ts-ignore
			data[i].meta_data = data[i].metadataUi.metadataValues;
			//@ts-ignore
			delete data[i].metadataUi;
		} else {
			//@ts-ignore
			delete data[i].metadataUi;
		}
	}
}

export function toSnakeCase(data:
	IShoppingLine[] |
	IShoppingLine[] |
	IFeeLine[] |
	ILineItem[] |
	ICouponLine[] |
	IDataObject) {
	if (!Array.isArray(data)) {
		data = [data];
	}
	let remove = false;
	for (let i = 0; i < data.length; i++) {
		for (const key of Object.keys(data[i])) {
			//@ts-ignore
			if (data[i][snakeCase(key)] === undefined) {
				remove = true;
			}
			//@ts-ignore
			data[i][snakeCase(key)] = data[i][key];
			if (remove) {
				//@ts-ignore
				delete data[i][key];
				remove = false;
			}
		}
	}
}

export function setFields(fieldsToSet: IDataObject, body: IDataObject) {
	for(const fields in fieldsToSet) {
		if (fields === 'tags') {
			body['tags'] = (fieldsToSet[fields] as string[]).map(tag => ({id: parseInt(tag, 10)}));
		} else {
			body[snakeCase(fields.toString())] = fieldsToSet[fields];
		}
		
	}
}

export function adjustMetadata(fields: IDataObject & Metadata) {
	if (!fields.meta_data) return fields;

	return {
		...omit(fields, ['meta_data']),
		meta_data: fields.meta_data.meta_data_fields,
	};
}

type Metadata = {
	meta_data?: {
		meta_data_fields: Array<{ key: string; value: string }>;
	}
};

export function validateJSON(json: string | undefined): any { // tslint:disable-line:no-any
	let result;
	try {
		result = JSON.parse(json!);
	} catch (exception) {
		result = undefined;
	}
	return result;
}

/**
 * Creates an object from an array with names values
 *
 * @export
 * @param Array<{key:string,value:string}> data
 * @returns IDataObject
 */
export function parseNameValueArray(data: Array<{name:string,value:string}>): IDataObject {
	const jsonData: IDataObject = {};
	if(data) {
		for (let i = 0; i < data.length; i++) {
			if (data[i].name && data[i].value) {
				jsonData[data[i].name] = data[i].value;
			}
		}
	}
	return jsonData;
}