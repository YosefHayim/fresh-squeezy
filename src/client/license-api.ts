import { postLicenseForm } from "@/client/http.js";

export interface LicenseKeyDetails {
	id: number;
	status: "inactive" | "active" | "expired" | "disabled";
	key: string;
	activation_limit: number | null;
	activation_usage: number;
	created_at: string;
	expires_at: string | null;
}

export interface LicenseInstanceDetails {
	id: string;
	name: string;
	created_at: string;
}

export interface LicenseMeta {
	store_id: number;
	order_id: number;
	order_item_id: number;
	product_id: number;
	product_name: string;
	variant_id: number;
	variant_name: string;
	customer_id: number;
	customer_name: string;
	customer_email: string;
}

interface LicenseReply {
	error: string | null;
	license_key?: LicenseKeyDetails;
	meta?: LicenseMeta;
}

export interface ActivateLicenseReply extends LicenseReply {
	activated: boolean;
	instance?: LicenseInstanceDetails;
}

export interface ValidateLicenseReply extends LicenseReply {
	valid: boolean;
	instance?: LicenseInstanceDetails | null;
}

export interface DeactivateLicenseReply extends LicenseReply {
	deactivated: boolean;
}

export interface ActivateLicenseRequest {
	licenseKey: string;
	instanceName: string;
}

export interface ValidateLicenseRequest {
	licenseKey: string;
	instanceId?: string;
}

export interface DeactivateLicenseRequest {
	licenseKey: string;
	instanceId: string;
}

export const activateLicense = ({
	licenseKey,
	instanceName,
}: ActivateLicenseRequest) =>
	postLicenseForm<ActivateLicenseReply>({
		action: "activate",
		fields: { license_key: licenseKey, instance_name: instanceName },
	});

export const validateLicense = ({
	licenseKey,
	instanceId,
}: ValidateLicenseRequest) =>
	postLicenseForm<ValidateLicenseReply>({
		action: "validate",
		fields: { license_key: licenseKey, instance_id: instanceId },
	});

export const deactivateLicense = ({
	licenseKey,
	instanceId,
}: DeactivateLicenseRequest) =>
	postLicenseForm<DeactivateLicenseReply>({
		action: "deactivate",
		fields: { license_key: licenseKey, instance_id: instanceId },
	});
