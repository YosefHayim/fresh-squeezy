import { readFileSync } from "node:fs";
import ts from "typescript";

const TYPES_FILE_NAME = "lemon-squeezy-types.ts";

const listPropertySignatures = (declaration: ts.InterfaceDeclaration) =>
	declaration.members.filter(ts.isPropertySignature);

const readPropertyName = (property: ts.PropertySignature) => {
	const { name } = property;

	const isIdentifierName = ts.isIdentifier(name);
	if (isIdentifierName) return name.text;

	const isStringLiteralName = ts.isStringLiteral(name);
	if (isStringLiteralName) return name.text;

	throw new Error("Interface property name is not an identifier or a string");
};

const listPropertyNames = (declaration: ts.InterfaceDeclaration) =>
	listPropertySignatures(declaration).map(readPropertyName);

export const readAttributeKeys = (): Record<string, string[]> => {
	const typesFileUrl = new URL(
		`../src/client/${TYPES_FILE_NAME}`,
		import.meta.url,
	);
	const typesFileCode = readFileSync(typesFileUrl, "utf8");
	const typesSyntaxTree = ts.createSourceFile(
		TYPES_FILE_NAME,
		typesFileCode,
		ts.ScriptTarget.ES2022,
	);
	const interfaces = typesSyntaxTree.statements.filter(
		ts.isInterfaceDeclaration,
	);

	const keyEntries = interfaces.map((declaration): [string, string[]] => [
		declaration.name.text,
		listPropertyNames(declaration),
	]);
	const keysByInterfaceName = new Map(keyEntries);

	const resourceAttributes = interfaces.find(
		(declaration) => declaration.name.text === "ResourceAttributes",
	);
	const isResourceAttributesMissing = resourceAttributes == null;
	if (isResourceAttributesMissing) {
		throw new Error("ResourceAttributes is missing from the types file");
	}

	const resourceEntries = listPropertySignatures(resourceAttributes).map(
		(property): [string, string[]] => {
			const propertyName = readPropertyName(property);
			const typeNode = property.type;

			const isTypeMissing = typeNode == null;
			if (isTypeMissing) {
				throw new Error(`ResourceAttributes.${propertyName} has no type`);
			}

			const interfaceName = typeNode.getText(typesSyntaxTree);
			const attributeKeys = keysByInterfaceName.get(interfaceName);

			const isInterfaceMissing = attributeKeys == null;
			if (isInterfaceMissing) {
				throw new Error(
					`ResourceAttributes.${propertyName} is ${interfaceName}, which is not an interface in the types file`,
				);
			}

			return [propertyName, attributeKeys];
		},
	);
	return Object.fromEntries(resourceEntries);
};
