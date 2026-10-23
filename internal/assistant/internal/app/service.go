package app

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
)

type Service struct {
	repo     Repository
	box      Sealer // nil without EQUORI_SECRET_KEY
	models   ModelLister
	instance []Instance
	uses     []Use
	now      func() time.Time
	today    func() time.Time
	log      *slog.Logger
}

// NewService takes the clock as now (an instant) and today (the instance's date).
func NewService(repo Repository, box Sealer, models ModelLister, instance []Instance, uses []Use, now, today func() time.Time, log *slog.Logger) *Service {
	return &Service{repo: repo, box: box, models: models, instance: instance, uses: uses, now: now, today: today, log: log}
}

// ProviderView is a provider as the owner sees it: never its key.
type ProviderView struct {
	ID       string
	Preset   string
	Name     string
	BaseURL  string
	HasKey   bool
	Notice   domain.Notice
	Instance bool
}

type ProviderInput struct {
	Preset, Name, BaseURL, Key string
}

// ProviderPatch changes the fields it sets; a nil Key keeps the stored key.
type ProviderPatch struct {
	Name, BaseURL, Key *string
}

func keyRow(userID int64, id uuid.UUID) []byte {
	return fmt.Appendf(nil, "assistant_provider|%d|%s", userID, id)
}

func notice(preset string) domain.Notice {
	p, _ := domain.FindPreset(preset)
	return p.Notice
}

func view(p domain.Provider) ProviderView {
	return ProviderView{ID: p.ID.String(), Preset: p.Preset, Name: p.Name, BaseURL: p.BaseURL, HasKey: p.SealedKey != nil, Notice: notice(p.Preset)}
}

func instanceView(in Instance) ProviderView {
	return ProviderView{ID: in.ID, Preset: in.Preset, Name: in.ID, HasKey: true, Notice: notice(in.Preset), Instance: true}
}

func (s *Service) Presets() []domain.Preset { return domain.Presets() }

// Providers returns the user's providers in creation order, then the instance providers.
func (s *Service) Providers(ctx context.Context, userID int64) ([]ProviderView, error) {
	ps, err := s.repo.Providers(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]ProviderView, 0, len(ps)+len(s.instance))
	for _, p := range ps {
		out = append(out, view(p))
	}
	for _, in := range s.instance {
		out = append(out, instanceView(in))
	}
	return out, nil
}

func (s *Service) seal(userID int64, id uuid.UUID, key string) ([]byte, error) {
	if key == "" {
		return nil, nil
	}
	if s.box == nil {
		return nil, ErrSecretKeyMissing
	}
	return s.box.Seal([]byte(key), keyRow(userID, id))
}

func (s *Service) CreateProvider(ctx context.Context, userID int64, in ProviderInput) (ProviderView, error) {
	p, err := domain.NewProvider(uuid.New(), userID, in.Preset, in.Name, in.BaseURL, in.Key != "", s.now())
	if err != nil {
		return ProviderView{}, err
	}
	if p.SealedKey, err = s.seal(userID, p.ID, in.Key); err != nil {
		return ProviderView{}, err
	}
	if err := s.repo.InsertProvider(ctx, p); err != nil {
		return ProviderView{}, err
	}
	return view(p), nil
}

func (s *Service) UpdateProvider(ctx context.Context, userID int64, id uuid.UUID, patch ProviderPatch) (ProviderView, error) {
	p, err := s.repo.Provider(ctx, userID, id)
	if err != nil {
		return ProviderView{}, err
	}
	if patch.Name != nil {
		if err := p.Rename(*patch.Name); err != nil {
			return ProviderView{}, err
		}
	}
	if patch.BaseURL != nil {
		if err := p.Move(*patch.BaseURL); err != nil {
			return ProviderView{}, err
		}
	}
	if patch.Key != nil {
		if *patch.Key == "" && p.KeyRequired() {
			return ProviderView{}, domain.ErrKeyRequired
		}
		if p.SealedKey, err = s.seal(userID, p.ID, *patch.Key); err != nil {
			return ProviderView{}, err
		}
	}
	if err := s.repo.UpdateProvider(ctx, p); err != nil {
		return ProviderView{}, err
	}
	return view(p), nil
}

func (s *Service) DeleteProvider(ctx context.Context, userID int64, id uuid.UUID) error {
	return s.repo.DeleteProvider(ctx, userID, id)
}

// ProviderModels asks the provider's API for its models, which also checks its key.
func (s *Service) ProviderModels(ctx context.Context, userID int64, id uuid.UUID) ([]string, error) {
	p, err := s.repo.Provider(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	key, err := s.open(p)
	if err != nil {
		return nil, err
	}
	preset, _ := domain.FindPreset(p.Preset)
	return s.models.Models(ctx, preset.API, p.BaseURL, key)
}

func (s *Service) open(p domain.Provider) (string, error) {
	if p.SealedKey == nil {
		return "", nil
	}
	if s.box == nil {
		return "", ErrSecretKeyMissing
	}
	plain, err := s.box.Open(p.SealedKey, keyRow(p.UserID, p.ID))
	if err != nil {
		return "", fmt.Errorf("provider %s: %w", p.ID, err)
	}
	return string(plain), nil
}

// RotateSecrets reseals every user's keys under the current key in one database
// transaction and returns how many changed (ADR 008 K4).
func (s *Service) RotateSecrets(ctx context.Context) (int, error) {
	if s.box == nil {
		return 0, ErrSecretKeyMissing
	}
	return s.repo.ResealKeys(ctx, func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error) {
		if !s.box.NeedsReseal(sealed) {
			return nil, nil
		}
		plain, err := s.box.Open(sealed, keyRow(userID, id))
		if err != nil {
			return nil, fmt.Errorf("provider %s: %w", id, err)
		}
		return s.box.Seal(plain, keyRow(userID, id))
	})
}

func (s *Service) use(id string) (Use, bool) {
	i := slices.IndexFunc(s.uses, func(u Use) bool { return u.ID == id })
	if i < 0 {
		return Use{}, false
	}
	return s.uses[i], true
}
