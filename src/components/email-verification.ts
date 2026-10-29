export function verificationVariant(status: string | null): "success" | "warning" | "destructive" {
  if (status === "valid") return "success";
  if (status === "invalid" || status === "disposable") return "destructive";
  return "warning";
}

export function verificationLabel(status: string | null): string {
  switch (status) {
    case "valid":
      return "Verified";
    case "accept_all":
      return "Accept-all";
    case "invalid":
      return "Invalid";
    case "webmail":
      return "Webmail";
    case "disposable":
      return "Disposable";
    default:
      return "Unverified";
  }
}
