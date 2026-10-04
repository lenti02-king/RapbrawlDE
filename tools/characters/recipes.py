"""Character recipes: body shape (MakeHuman macro + detail modifiers), outfit, hair, skin and decals.

Values are art direction toward the product owner's reference photos, in a slightly heroic fighting-game style
(broader shoulders, bigger hands and arms than a neutral body). Modifier keys are MakeHuman target groups without
the min/max suffix; positive values pick the 'incr/more/up/...' side.
"""

HEROIC = {
    'torso-torso-vshape': 0.55,
    'measure-measure-upperarm': 0.45,
    'measure-measure-neckcirc': 0.35,
    'armslegs-l-hand-scale': 0.35,
    'armslegs-r-hand-scale': 0.35,
    'armslegs-l-upperarm-muscle': 0.4,
    'armslegs-r-upperarm-muscle': 0.4,
    'armslegs-l-lowerarm-muscle': 0.35,
    'armslegs-r-lowerarm-muscle': 0.35,
    'torso-torso-muscle-pectoral': 0.35,
    'torso-torso-muscle-dorsi': 0.4,
}

RECIPES = {
    'bonez': {
        # very tall (1.98 m), long face, light eyes, short dark-blond curls, light beard, black outfit, tattooed hands
        'macro': dict(gender=1.0, age=0.58, muscle=0.72, weight=0.56, height=1.0, proportions=0.9,
                      african=0.0, asian=0.0, caucasian=1.0),
        'modifiers': {
            **HEROIC,
            'head-head-oval': 0.5,
            'head-head-scale-vert': 0.3,
            'head-head-scale-horiz': -0.12,
            'chin-chin-height': 0.35,
            'chin-chin-prominent': 0.3,
            'chin-chin-width': 0.15,
            'nose-nose-scale-vert': 0.2,
            'eyebrows-eyebrows-trans-depth': 0.3,
            'cheek-l-cheek-bones': 0.25,
            'cheek-r-cheek-bones': 0.25,
        },
        'skin': {'blend': {'young_caucasian_male': 1.0}, 'tint': (1.0, 0.97, 0.95)},
        'beard': {'color': (0.25, 0.19, 0.13), 'cheeks': 0.85, 'chin': 1.0, 'moustache': 0.9, 'neck': 0.4, 'length': 0.7},
        'tattoos': {'hands': True, 'forearms': True, 'upperarms': False, 'seed': 7},
        'hair_color': (0.36, 0.28, 0.19),
        'brow_color': (0.22, 0.17, 0.12),
        'eye_texture': 'ice_eye.png',
        'outfit': {'top': 'black_tee', 'pants': 'black_jeans', 'shoes': 'black'},
        'proxies': [
            {'kind': 'eyes', 'name': 'HighPolyEyes'},
            {'kind': 'eyebrows', 'name': 'eyebrow009'},
            {'kind': 'eyelashes', 'name': 'Eyelashes01'},
            {'kind': 'hair', 'name': 'short02'},
            {'kind': 'clothes', 'name': 'male_casualsuit04'},
            {'kind': 'clothes', 'name': 'shoes06'},
        ],
        'accessories': [
            {'type': 'vest', 'from': 'male_casualsuit04', 'thickness': 0.28, 'open_front': 0.32},
            {'type': 'scarf', 'look': 'knit_black', 'over': ['male_casualsuit04']},
            {'type': 'chain', 'name': 'goldchain', 'look': 'gold_cuban', 'radius': 0.075, 'drop': 2.1, 'offset': 0.1,
             'over': ['male_casualsuit04'], 'pendant': {'shape': 'cross', 'size': 0.6}},
            {'type': 'watch', 'name': 'watch', 'look': 'gold', 'side': 'L'},
        ],
    },
    'jazeek': {
        # 1.80 m, athletic, dense black curls, light moustache + short chin beard, white ribbed tank top,
        # beige monogram trousers, white sneakers, silver chains, tattoos on both arms
        'macro': dict(gender=1.0, age=0.5, muscle=0.7, weight=0.46, height=0.62, proportions=1.0,
                      african=0.3, asian=0.12, caucasian=0.58),
        'modifiers': {
            **HEROIC,
            'head-head-round': 0.15,
            'chin-chin-width': 0.15,
            'nose-nose-scale-horiz': 0.1,
            'mouth-mouth-lowerlip-volume': 0.2,
        },
        'skin': {'blend': {'young_caucasian_male': 0.55, 'young_african_male': 0.45}, 'tint': (1.02, 0.96, 0.9)},
        'beard': {'color': (0.06, 0.05, 0.045), 'cheeks': 0.2, 'chin': 0.9, 'moustache': 0.75, 'neck': 0.1, 'length': 0.45},
        'tattoos': {'hands': False, 'forearms': True, 'upperarms': True, 'seed': 3},
        'hair_color': (0.05, 0.04, 0.035),
        'eye_texture': 'brown_eye.png',
        'outfit': {'top': 'white_tank', 'pants': 'beige_monogram', 'shoes': 'white'},
        'proxies': [
            {'kind': 'eyes', 'name': 'HighPolyEyes'},
            {'kind': 'eyebrows', 'name': 'eyebrow009'},
            {'kind': 'eyelashes', 'name': 'Eyelashes01'},
            {'kind': 'hair', 'name': 'afro01', 'shrink': 0.96},
            {'kind': 'clothes', 'name': 'Tank_Top_01'},
            {'kind': 'clothes', 'name': 'male_casualsuit04', 'keep_below_uv_v': 0.59},
            {'kind': 'clothes', 'name': 'shoes05'},
        ],
        'accessories': [
            {'type': 'chain', 'name': 'silverchain1', 'look': 'silver_rope', 'radius': 0.035, 'drop': 1.3, 'offset': 0.11, 'over': ['Tank_Top_01']},
            {'type': 'chain', 'name': 'silverchain2', 'look': 'silver_cuban', 'radius': 0.05, 'drop': 2.2, 'offset': 0.12,
             'over': ['Tank_Top_01'], 'pendant': {'shape': 'round', 'size': 0.5}},
            {'type': 'watch', 'name': 'watch', 'look': 'silver', 'side': 'L'},
        ],
    },
}
