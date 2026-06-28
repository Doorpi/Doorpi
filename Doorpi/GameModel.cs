using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Doorpi
{
    public class GameModel
    {
        public string Name { get; set; } = "";
        public string Path { get; set; } = "";
        public string LaunchUrl { get; set; } = "";

        public DateTime DateAdded { get; set; } = DateTime.Now;
        public string GridImage { get; set; } = "";
        public string GridHorizontalImage { get; set; } = "";
        public string HeroImage { get; set; } = "";
        public string LogoImage { get; set; } = "";
        public long TotalPlaytimeMinutes { get; set; } = 0;
        public int LastSessionMinutes { get; set; } = 0;
        public string GridStaticImage { get; set; } = "";
        public string GridHorizontalStaticImage { get; set; } = "";
        public string HeroStaticImage { get; set; } = "";
        public string LogoStaticImage { get; set; } = "";
        public string IconBase64 { get; set; } = "";

        public DateTime LastPlayed { get; set; }
        public bool IsPendingArtwork { get; set; } = false;
        public bool AutoAddedByBootstrap { get; set; } = false;
        public string ArtworkSource { get; set; } = "";
        public string Source { get; set; } = "";
    }
}
