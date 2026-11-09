using Doorpi.Storage;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace Doorpi;

public partial class MainWindow
{
    private readonly ConditionalWeakTable<List<GameModel>, GameStateRevision> _gameStateRevisions = new();
    private readonly ConditionalWeakTable<List<GameHistoryEntry>, GameStateRevision> _historyStateRevisions = new();

    private sealed class GameStateRevision(string path, string owner, long revision)
    {
        public string Path { get; } = path;
        public string Owner { get; } = owner;
        public long Revision { get; set; } = revision;
    }

    private void TrackGameState(List<GameModel> games, string path, string owner, long revision)
    {
        _gameStateRevisions.Remove(games);
        _gameStateRevisions.Add(games, new GameStateRevision(path, owner, revision));
    }

    private void SaveGameArtwork(List<GameModel> snapshot, GameModel game)
    {
        if (!_gameStateRevisions.TryGetValue(snapshot, out var captured))
            throw new InvalidOperationException("Artwork updates require a versioned library snapshot.");
        if (!string.Equals(captured.Owner, currentUserId, StringComparison.OrdinalIgnoreCase))
            throw new OperationCanceledException("O perfil mudou antes da confirmação da arte.");
        string patch = JsonSerializer.Serialize(new
        {
            game.GridImage, game.GridHorizontalImage, game.GridStaticImage, game.GridHorizontalStaticImage,
            game.GridSourceUrl, game.GridHorizontalSourceUrl, game.HeroImage, game.HeroStaticImage,
            game.HeroSourceUrl, game.LogoImage, game.LogoStaticImage, game.ArtworkSource, game.IsPendingArtwork
        });
        if (string.IsNullOrWhiteSpace(game.Id))
            throw new InvalidDataException("O jogo não possui identidade persistente para atualizar a arte.");
        long committedRevision = 0;
        StateStorage.ExecuteTransaction(() =>
        {
            StateStorage.UpdateCollectionItem(captured.Path, game.Id, patch, captured.Revision);
            committedRevision = StateStorage.GetRevision(captured.Path);
        });
        captured.Revision = committedRevision;
    }

    private List<GameHistoryEntry> LoadGameHistoryForOwner(string owner)
    {
        string path = Path.Combine(dataFolder, "users", owner, "game-history.json");
        var snapshot = StateStorage.ReadEntitySnapshot(path);
        var history = snapshot.Entities.Select(entity => JsonSerializer.Deserialize<GameHistoryEntry>(entity.Payload)
            ?? throw new InvalidDataException("Histórico inválido.")).ToList();
        _historyStateRevisions.Add(history, new GameStateRevision(path, owner, snapshot.Revision));
        return history;
    }
}
