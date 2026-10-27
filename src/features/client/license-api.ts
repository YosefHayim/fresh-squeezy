import { postLicenseForm } from "@/shared/http.js";

export interface LicenseKeyInfo {
	id: number;
	status: "inactive" | "active" | "expired" | "disabled";
	key: string;
	activation_limit: number | null;
	activation_usage: number;
	created_at: string;
	expires_at: string | null;
}

export interface LicenseInstanceInfo {
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

interface LicenseResponse {
	error: string | null;
	license_key: LicenseKeyInfo;
	meta: LicenseMeta;
}

export interface ActivateLicenseResponse extends LicenseResponse {
	activated: boolean;
	instance?: LicenseInstanceInfo;
}

export interface ValidateLicenseResponse extends LicenseResponse {
	valid: boolean;
	instance: LicenseInstanceInfo | null;
}

export interface DeactivateLicenseResponse extends LicenseResponse {
	deactivated: boolean;
}

export interface ActivateLicenseInput {
	licenseKey: string;
	instanceName: string;
}

export interface ValidateLicenseInput {
	licenseKey: string;
	instanceId?: string;
}

export interface DeactivateLicenseInput {
	licenseKey: string;
	instanceId: string;
}

export const activateLicense = ({
	licenseKey,
	instanceName,
}: ActivateLicenseInput) =>
	postLicenseForm<ActivateLicenseResponse>({
		action: "activate",
		fields: { license_key: licenseKey, instance_name: instanceName },
	});

export const validateLicense = ({
	licenseKey,
	instanceId,
}: ValidateLicenseInput) =>
	postLicenseForm<ValidateLicenseResponse>({
		action: "validate",
		fields: { license_key: licenseKey, instance_id: instanceId },
	});

export const deactivateLicense = ({
	licenseKey,
	instanceId,
}: DeactivateLicenseInput) =>
	postLicenseForm<DeactivateLicenseResponse>({
		action: "deactivate",
		fields: { license_key: licenseKey, instance_id: instanceId },
	});
