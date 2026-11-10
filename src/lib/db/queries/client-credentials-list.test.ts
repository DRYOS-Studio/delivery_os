import { describe, expect, it } from "vitest";

const LIST_SELECT =
  "id, client_id, operation_id, service_name, url, login_username, key_version, created_by, updated_by, archived_at, created_at, updated_at";

describe("client credentials list metadata", () => {
  it("select da lista não inclui campos cifrados", () => {
    expect(LIST_SELECT).not.toContain("password");
    expect(LIST_SELECT).not.toContain("ciphertext");
    expect(LIST_SELECT).not.toContain("notes");
  });
});
