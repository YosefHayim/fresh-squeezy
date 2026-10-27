import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ResourceType } from "@/client/lemon-squeezy-types.js";

const TYPES_FILE = new URL(
	"../src/client/lemon-squeezy-types.ts",
	import.meta.url,
);

type NamedMember = ts.PropertySignature & {
	name: ts.Identifier | ts.StringLiteral;
};

const propertiesOf = (declaration: ts.InterfaceDeclaration) =>
	declaration.members.filter(ts.isPropertySignature) as NamedMember[];

const keysOf = (declaration: ts.InterfaceDeclaration) => {
	const properties = propertiesOf(declaration);
	return properties.map((member) => member.name.text);
};

export const readAttributeKeys = () => {
	const sourceText = readFileSync(TYPES_FILE, "utf8");
	const sourceFile = ts.createSourceFile(
		"lemon-squeezy-types.ts",
		sourceText,
		ts.ScriptTarget.ES2022,
	);
	const interfaces = sourceFile.statements.filter(ts.isInterfaceDeclaration);
	const keyEntries = interfaces.map((declaration) => [
		declaration.name.text,
		keysOf(declaration),
	]);
	const keysByInterface = new Map(keyEntries as [string, string[]][]);
	const resourceMap = interfaces.find(
		(declaration) => declaration.name.text === "ResourceAttributes",
	) as ts.InterfaceDeclaration;
	const resourceProperties = propertiesOf(resourceMap);
	const resourceEntries = resourceProperties.map((member) => {
		const interfaceName = member.type?.getText(sourceFile) ?? "";
		const keys = keysByInterface.get(interfaceName) ?? [];
		return [member.name.text, keys];
	});
	return Object.fromEntries(resourceEntries) as Record<ResourceType, string[]>;
};
