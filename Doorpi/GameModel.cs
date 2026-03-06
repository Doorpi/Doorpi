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

       
        public string GridImage { get; set; } = "";
        public string GridHorizontalImage { get; set; } = "";
        public string HeroImage { get; set; } = "";
        public string LogoImage { get; set; } = "";

       
        public string GridStaticImage { get; set; } = "";
        public string GridHorizontalStaticImage { get; set; } = "";
        public string HeroStaticImage { get; set; } = "";
        public string LogoStaticImage { get; set; } = "";

        public DateTime LastPlayed { get; set; }
    }
}
