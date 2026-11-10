import { readFileSync } from "node:fs";
import ts from "typescript";

const TYPES_FILE = new URL(
	"../src/client/lemon-squeezy-types.ts",
	import.meta.url,
);

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
	const sourceText = readFileSync(TYPES_FILE, "utf8");
	const sourceFile = ts.createSourceFile(
		"lemon-squeezy-types.ts",
		sourceText,
		ts.ScriptTarget.ES2022,
	);
	const interfaces = sourceFile.statements.filter(ts.isInterfaceDeclaration);

	const keyEntries = interfaces.map(
		(declaration): [string, string[]] => [
			declaration.name.text,
			listPropertyNames(declaration),
		],
	);
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
			const interfaceName = property.type?.getText(sourceFile) ?? "";
			const attributeKeys = keysByInterfaceName.get(interfaceName) ?? [];
			return [readPropertyName(property), attributeKeys];
		},
	);
	return Object.fromEntries(resourceEntries);
};
