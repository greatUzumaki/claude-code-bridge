package terminal

import (
	"os/exec"
	"testing"
)

func TestSessionNameSanitizes(t *testing.T) {
	if got := SessionName("p_api", 0); got != "wt_p_api" {
		t.Fatalf("got %q", got)
	}
	if got := SessionName("weird/id..x", 0); got != "wt_weird_id__x" {
		t.Fatalf("got %q", got)
	}
	if got := SessionName("p_api", 2); got != "wt_p_api_2" {
		t.Fatalf("got %q", got)
	}
}

func TestSessionNameCases(t *testing.T) {
	cases := []struct {
		id   string
		n    int
		want string
	}{
		// plain id, n=0 → prefix only
		{"myapp", 0, "wt_myapp"},
		// spaces replaced with _
		{"my app", 0, "wt_my_app"},
		// slashes replaced with _
		{"org/repo", 0, "wt_org_repo"},
		// dots replaced with _
		{"api.service", 0, "wt_api_service"},
		// mixed non-alnum
		{"a b/c.d", 0, "wt_a_b_c_d"},
		// n>0 appends _<n>
		{"proj", 1, "wt_proj_1"},
		{"proj", 42, "wt_proj_42"},
		// already safe id
		{"p_foo", 0, "wt_p_foo"},
		{"p_foo", 2, "wt_p_foo_2"},
	}
	for _, tc := range cases {
		got := SessionName(tc.id, tc.n)
		if got != tc.want {
			t.Errorf("SessionName(%q, %d) = %q, want %q", tc.id, tc.n, got, tc.want)
		}
	}
}

func TestSafeSessionNameRegexp(t *testing.T) {
	matching := []string{
		"wt_p_foo",
		"wt_p_foo_2",
		"wt_myapp",
		"wt_a_b_c",
	}
	for _, s := range matching {
		if !safeSessionName.MatchString(s) {
			t.Errorf("safeSessionName should match %q but did not", s)
		}
	}

	notMatching := []string{
		"wt_p foo",        // space — not safe
		"wt_'; rm",        // shell metacharacters
		"p_foo",           // missing wt_ prefix
		"wt_",             // empty body after prefix
		"",                // empty string
		"wt_ leading",     // space after prefix
	}
	for _, s := range notMatching {
		if safeSessionName.MatchString(s) {
			t.Errorf("safeSessionName should NOT match %q but did", s)
		}
	}
}

func TestEnsureListKillRoundTrip(t *testing.T) {
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux not installed")
	}
	name := SessionName("test_roundtrip", 0)
	_ = Kill(name) // clean slate
	if err := ensure(name, t.TempDir()); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	names, _ := List()
	found := false
	for _, n := range names {
		if n == name {
			found = true
		}
	}
	if !found {
		t.Fatalf("session %q not in List() = %v", name, names)
	}
	if err := Kill(name); err != nil {
		t.Fatalf("kill: %v", err)
	}
}
